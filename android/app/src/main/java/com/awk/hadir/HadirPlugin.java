package com.awk.hadir;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
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

    @PluginMethod
    public void downloadLiveUpdate(PluginCall call) {
        String urlString = call.getString("url");
        String version = call.getString("version");
        if (urlString == null || urlString.isEmpty() || version == null || version.isEmpty()) {
            call.reject("Missing update URL or version");
            return;
        }

        new Thread(() -> {
            InputStream input = null;
            OutputStream output = null;
            HttpURLConnection connection = null;
            try {
                URL currentUrl = new URL(urlString);
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

                File liveUpdatesDir = new File(getContext().getFilesDir(), "live_updates");
                if (!liveUpdatesDir.exists()) liveUpdatesDir.mkdirs();

                File zipFile = new File(liveUpdatesDir, "update_" + version + ".zip");
                if (zipFile.exists()) zipFile.delete();

                input = connection.getInputStream();
                output = new FileOutputStream(zipFile);

                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                }
                output.flush();
                output.close();
                output = null;
                input.close();
                input = null;

                File targetDir = new File(liveUpdatesDir, version);
                if (targetDir.exists()) deleteRecursive(targetDir);
                targetDir.mkdirs();

                unzip(zipFile, targetDir);
                zipFile.delete();

                File indexHtml = findIndexHtml(targetDir);
                if (indexHtml == null) {
                    deleteRecursive(targetDir);
                    call.reject("Invalid live update: index.html missing");
                    return;
                }

                File serveDir = indexHtml.getParentFile();
                if (serveDir == null) serveDir = targetDir;

                SharedPreferences prefs = getContext().getSharedPreferences(
                    com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                    Activity.MODE_PRIVATE
                );
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, serveDir.getAbsolutePath());
                editor.putString("uni_ranked_live_version", version);
                editor.apply();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("version", version);
                ret.put("path", serveDir.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Live update download failed: " + e.getMessage(), e);
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void reloadWebview(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                SharedPreferences prefs = getContext().getSharedPreferences(
                    com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                    Activity.MODE_PRIVATE
                );
                String path = prefs.getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, null);
                if (path != null && !path.isEmpty() && new File(path).exists()) {
                    getBridge().setServerBasePath(path);
                }
                getBridge().getWebView().reload();
                call.resolve();
            } catch (Exception e) {
                call.reject("Reload failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void resetLiveUpdate(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
            Activity.MODE_PRIVATE
        );
        prefs.edit().remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH).remove("uni_ranked_live_version").apply();
        call.resolve();
    }

    @PluginMethod
    public void getLiveUpdateVersion(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
            Activity.MODE_PRIVATE
        );
        String v = prefs.getString("uni_ranked_live_version", null);
        JSObject ret = new JSObject();
        ret.put("version", v);
        call.resolve(ret);
    }

    private static void unzip(File zipFile, File targetDir) throws Exception {
        ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile));
        ZipEntry ze;
        byte[] buffer = new byte[8192];
        while ((ze = zis.getNextEntry()) != null) {
            String name = ze.getName();
            File destFile = new File(targetDir, name);
            String canonicalDest = destFile.getCanonicalPath();
            if (!canonicalDest.startsWith(targetDir.getCanonicalPath() + File.separator)) {
                throw new SecurityException("Zip entry is outside target: " + name);
            }
            if (ze.isDirectory()) {
                destFile.mkdirs();
            } else {
                File parent = destFile.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                FileOutputStream fos = new FileOutputStream(destFile);
                int len;
                while ((len = zis.read(buffer)) > 0) {
                    fos.write(buffer, 0, len);
                }
                fos.close();
            }
            zis.closeEntry();
        }
        zis.close();
    }

    private static File findIndexHtml(File dir) {
        File direct = new File(dir, "index.html");
        if (direct.exists()) return direct;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) {
                    File found = findIndexHtml(f);
                    if (found != null) return found;
                }
            }
        }
        return null;
    }

    private static void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] files = f.listFiles();
            if (files != null) {
                for (File c : files) deleteRecursive(c);
            }
        }
        f.delete();
    }
}
