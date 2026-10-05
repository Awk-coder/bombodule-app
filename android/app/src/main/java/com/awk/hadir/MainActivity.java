package com.awk.hadir;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HadirPlugin.class);
        super.onCreate(savedInstanceState);
        // No stretch/glow at the scroll ends: it drags the fixed tab bar along with the page.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
