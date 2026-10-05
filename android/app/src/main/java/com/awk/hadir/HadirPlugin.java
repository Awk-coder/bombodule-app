package com.awk.hadir;

import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
}
