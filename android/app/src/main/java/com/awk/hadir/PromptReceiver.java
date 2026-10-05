package com.awk.hadir;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarm firings, card button taps, and re-arming alarms after a reboot or update. */
public class PromptReceiver extends BroadcastReceiver {
    static final String FIRE = "com.awk.hadir.PROMPT_FIRE";
    static final String ANSWER = "com.awk.hadir.PROMPT_ANSWER";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (FIRE.equals(action)) {
            Prompts.fire(ctx, intent.getIntExtra("id", 0));
        } else if (ANSWER.equals(action)) {
            Prompts.answer(ctx, intent.getIntExtra("id", 0), intent.getStringExtra("sessionId"), intent.getStringExtra("mark"));
            HadirPlugin.answered();
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Prompts.rearm(ctx);
        }
    }
}
