package com.awk.hadir;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HadirPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
