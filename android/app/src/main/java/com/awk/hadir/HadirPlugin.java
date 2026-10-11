package com.awk.hadir;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONException;

@CapacitorPlugin(name = "Hadir")
public class HadirPlugin extends Plugin {
    private static HadirPlugin instance; // the live bridge's plugin, so card answers can reach JS

    @Override
    public void load() {
        instance = this;
    }

    /** A prompt card was answered; tell JS (if the app is running) to take the answers. */
    static void answered() {
        HadirPlugin p = instance;
        if (p != null) p.notifyListeners("answer", new JSObject());
    }

    @PluginMethod
    public void schedulePrompts(PluginCall call) {
        try {
            Prompts.replace(getContext(), call.getArray("items"));
            call.resolve();
        } catch (Exception e) {
            call.reject("schedulePrompts failed", e);
        }
    }

    @PluginMethod
    public void takeAnswers(PluginCall call) {
        try {
            call.resolve(JSObject.fromJSONObject(Prompts.take(getContext())));
        } catch (JSONException e) {
            call.reject("takeAnswers failed", e);
        }
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("value", pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void setLightBars(PluginCall call) {
        boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        getActivity().runOnUiThread(() -> {
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getActivity().getWindow(), getActivity().getWindow().getDecorView());
            c.setAppearanceLightStatusBars(light);
            c.setAppearanceLightNavigationBars(light);
            call.resolve();
        });
    }

    @PluginMethod
    public void canInstallApk(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("value", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("value", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing APK download URL");
            return;
        }

        new Thread(() -> {
            InputStream input = null;
            OutputStream output = null;
            HttpURLConnection connection = null;
            try {
                URL currentUrl = new URL(urlString);

                // Follow any HTTP redirects (e.g. GitHub Releases redirecting to AWS S3 storage)
                while (true) {
                    connection = (HttpURLConnection) currentUrl.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "Uni-Ranked-Android");
                    connection.connect();
                    int code = connection.getResponseCode();
                    if (code == HttpURLConnection.HTTP_MOVED_TEMP || code == HttpURLConnection.HTTP_MOVED_PERM || code == 307 || code == 308) {
                        String newLoc = connection.getHeaderField("Location");
                        connection.disconnect();
                        currentUrl = new URL(newLoc);
                    } else {
                        break;
                    }
                }

                int fileLength = connection.getContentLength();
                input = connection.getInputStream();

                File cacheDir = getContext().getExternalCacheDir();
                if (cacheDir == null) cacheDir = getContext().getCacheDir();
                File apkFile = new File(cacheDir, "Uni-Ranked-update.apk");
                if (apkFile.exists()) apkFile.delete();

                output = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                long total = 0;
                int count;
                long lastNotify = 0;

                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    output.write(buffer, 0, count);
                    long now = System.currentTimeMillis();
                    if (fileLength > 0 && now - lastNotify > 200) {
                        lastNotify = now;
                        int percent = (int) (total * 100 / fileLength);
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        progress.put("bytes", total);
                        progress.put("total", fileLength);
                        notifyListeners("downloadProgress", progress);
                    }
                }
                output.flush();

                JSObject doneProgress = new JSObject();
                doneProgress.put("percent", 100);
                doneProgress.put("bytes", total);
                doneProgress.put("total", total);
                notifyListeners("downloadProgress", doneProgress);

                Uri apkUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        apkFile
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);

                call.resolve();
            } catch (Exception e) {
                call.reject("Download or install failed: " + e.getMessage(), e);
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        }).start();
    }
}
