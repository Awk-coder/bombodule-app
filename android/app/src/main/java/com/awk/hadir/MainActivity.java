package com.awk.hadir;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String EXTRA_ROUTE = "route";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        registerPlugin(HadirPlugin.class);
        super.onCreate(savedInstanceState);
        // No stretch/glow at the scroll ends: it drags the fixed tab bar along with the page.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        keepRoute(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        keepRoute(intent);
    }

    /** A tapped prompt card opens a route; JS picks it up with takeAnswers on start/resume. */
    private void keepRoute(Intent intent) {
        String route = intent != null ? intent.getStringExtra(EXTRA_ROUTE) : null;
        if (route != null) Prompts.setRoute(this, route);
    }
}
