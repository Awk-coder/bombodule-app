package com.awk.hadir;

import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Hadir")
public class HadirPlugin extends Plugin {
    private static final String CAS_URL =
        "https://cas.iium.edu.my:8448/cas/login?service=https%3A%2F%2Fimaluum.iium.edu.my%2Fhome";
    private static final String IMALUUM_HOST = "imaluum.iium.edu.my";

    @PluginMethod
    public void casLogin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            CookieManager cookies = CookieManager.getInstance();
            cookies.removeAllCookies(removed -> showLogin(call, cookies));
        });
    }

    private void showLogin(PluginCall call, CookieManager cookies) {
        Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_DeviceDefault_NoActionBar);
        WebView web = new WebView(getActivity());
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        cookies.setAcceptThirdPartyCookies(web, true);
        boolean[] finished = {false};
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (finished[0] || url == null || !IMALUUM_HOST.equals(Uri.parse(url).getHost())) return;
                String cookie = cookies.getCookie("https://" + IMALUUM_HOST);
                if (cookie == null || cookie.isEmpty()) return;
                finished[0] = true;
                JSObject ret = new JSObject();
                ret.put("cookie", cookie);
                call.resolve(ret);
                dialog.dismiss();
            }
        });
        dialog.setOnDismissListener(d -> {
            web.destroy();
            if (!finished[0]) {
                finished[0] = true;
                call.reject("cancelled");
            }
        });
        dialog.setContentView(web);
        dialog.show();
        web.loadUrl(CAS_URL);
    }

    @PluginMethod
    public void clearCookies(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            CookieManager cookies = CookieManager.getInstance();
            cookies.removeAllCookies(removed -> {
                cookies.flush();
                call.resolve();
            });
        });
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
}
