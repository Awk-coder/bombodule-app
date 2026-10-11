package com.awk.hadir;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Class prompts and absence warnings: stored, alarmed and drawn natively so they can carry the
 * custom card and be answered without opening the app. Answers queue here until JS takes them.
 */
final class Prompts {
    static final String CHANNEL = "prompts";
    private static final String PREFS = "hadir-prompts";
    private static final int[] BG = {
        R.drawable.notif_bg_0, R.drawable.notif_bg_1, R.drawable.notif_bg_2, R.drawable.notif_bg_3,
        R.drawable.notif_bg_4, R.drawable.notif_bg_5, R.drawable.notif_bg_6, R.drawable.notif_bg_7,
    };
    // Foreground colours of src/ui/palette.ts, same order.
    private static final String[] FG = { "#FFA65C", "#D9A8FF", "#C6F25A", "#A9B1FF", "#67E0F5", "#FFD84D", "#FF8FB5", "#9CC3E6" };

    private Prompts() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray array(Context ctx, String key) {
        try {
            return new JSONArray(prefs(ctx).getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    // ---- schedule -------------------------------------------------------------------------

    /** Replace every stored prompt and its alarm with {@code items}. */
    static synchronized void replace(Context ctx, JSONArray items) {
        JSONArray old = array(ctx, "items");
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        for (int i = 0; i < old.length(); i++) am.cancel(fireIntent(ctx, old.optJSONObject(i).optInt("id")));
        // Answered classes drop out of the plan once JS applies them; forget those no longer listed.
        JSONArray done = array(ctx, "done");
        JSONArray keep = new JSONArray();
        for (int i = 0; i < done.length(); i++) {
            String sid = done.optString(i);
            if (listed(items, sid)) keep.put(sid);
        }
        prefs(ctx).edit().putString("items", items.toString()).putString("done", keep.toString()).apply();
        arm(ctx, items);
    }

    private static boolean listed(JSONArray items, String sid) {
        for (int j = 0; j < items.length(); j++) {
            JSONObject it = items.optJSONObject(j);
            if (sid.equals(it.optString("sessionId"))) return true;
            JSONArray pending = it.optJSONArray("pending");
            for (int k = 0; pending != null && k < pending.length(); k++) {
                if (sid.equals(pending.optJSONObject(k).optString("sessionId"))) return true;
            }
        }
        return false;
    }

    /** Set alarms for the stored prompts still in the future (after boot or an app update). */
    static void rearm(Context ctx) {
        arm(ctx, array(ctx, "items"));
    }

    private static void arm(Context ctx, JSONArray items) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        long now = System.currentTimeMillis();
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            long at = it.optLong("at");
            if (at <= now) continue;
            PendingIntent pi = fireIntent(ctx, it.optInt("id"));
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static PendingIntent fireIntent(Context ctx, int id) {
        Intent i = new Intent(ctx, PromptReceiver.class)
            .setAction(PromptReceiver.FIRE)
            .setData(Uri.parse("prompt://fire/" + id))
            .putExtra("id", id);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // ---- answers --------------------------------------------------------------------------

    static synchronized void answer(Context ctx, int id, String sessionId, String mark) {
        try {
            JSONArray answers = array(ctx, "answers");
            answers.put(new JSONObject().put("sessionId", sessionId).put("mark", mark));
            JSONArray done = array(ctx, "done");
            done.put(sessionId);
            prefs(ctx).edit().putString("answers", answers.toString()).putString("done", done.toString()).apply();
        } catch (JSONException ignored) {}
        ctx.getSystemService(NotificationManager.class).cancel(id);
    }

    static void setRoute(Context ctx, String route) {
        prefs(ctx).edit().putString("route", route).apply();
    }

    /** Answers and the tapped route since the last call; clears both. */
    static synchronized JSONObject take(Context ctx) {
        SharedPreferences p = prefs(ctx);
        JSONObject out = new JSONObject();
        try {
            out.put("answers", array(ctx, "answers"));
            String route = p.getString("route", null);
            if (route != null) out.put("route", route);
        } catch (JSONException ignored) {}
        p.edit().remove("answers").remove("route").apply();
        return out;
    }

    // ---- show -----------------------------------------------------------------------------

    static void fire(Context ctx, int id) {
        JSONObject it = find(ctx, id);
        if (it == null || isDone(ctx, it.optString("sessionId"))) return;
        String kind = it.optString("kind");
        if ("nudge".equals(kind)) {
            it = withoutAnswered(ctx, it);
            if (it == null) return;
        }
        ensureChannel(ctx);
        Notification n = "attendance".equals(kind) ? card(ctx, it) : warning(ctx, it);
        ctx.getSystemService(NotificationManager.class).notify(id, n);
    }

    private static JSONObject find(Context ctx, int id) {
        JSONArray items = array(ctx, "items");
        for (int i = 0; i < items.length(); i++) if (items.optJSONObject(i).optInt("id") == id) return items.optJSONObject(i);
        return null;
    }

    /** The nudge with its body re-counted from classes not answered on a card since; null if none are left. */
    private static JSONObject withoutAnswered(Context ctx, JSONObject it) {
        JSONArray pending = it.optJSONArray("pending");
        StringBuilder codes = new StringBuilder();
        int left = 0;
        for (int i = 0; pending != null && i < pending.length(); i++) {
            JSONObject p = pending.optJSONObject(i);
            if (isDone(ctx, p.optString("sessionId"))) continue;
            if (left++ > 0) codes.append(", ");
            codes.append(p.optString("code"));
        }
        if (left == 0) return null;
        try {
            return new JSONObject(it.toString()).put("body", left + " unmarked: " + codes);
        } catch (JSONException e) {
            return it;
        }
    }

    private static boolean isDone(Context ctx, String sessionId) {
        JSONArray done = array(ctx, "done");
        for (int i = 0; i < done.length(); i++) if (sessionId.equals(done.optString(i))) return true;
        return false;
    }

    static void ensureChannel(Context ctx) {
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Class check-ins", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Did you attend? prompts as each class starts, end-of-day reminders, and absence warnings");
        ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    private static Notification card(Context ctx, JSONObject it) {
        int id = it.optInt("id");
        int color = Math.floorMod(it.optInt("color"), BG.length);
        int fg = Color.parseColor(FG[color]);
        String sid = it.optString("sessionId");
        String code = it.optString("code");

        RemoteViews small = new RemoteViews(ctx.getPackageName(), R.layout.notif_prompt_small);
        RemoteViews big = new RemoteViews(ctx.getPackageName(), R.layout.notif_prompt_big);
        for (RemoteViews v : new RemoteViews[] { small, big }) {
            v.setInt(R.id.root, "setBackgroundResource", BG[color]);
            v.setTextViewText(R.id.chip, code);
            v.setTextColor(R.id.chip, fg);
            v.setOnClickPendingIntent(R.id.yes, answerIntent(ctx, id, sid, "attended"));
            v.setOnClickPendingIntent(R.id.no, answerIntent(ctx, id, sid, "missed"));
        }
        big.setTextViewText(R.id.name, it.optString("name"));
        big.setTextViewText(R.id.meta, it.optString("venue") + "  ·  " + it.optString("time"));
        big.setTextViewText(R.id.dots, dots(it.optInt("missed"), it.optInt("limit"), fg));
        big.setViewVisibility(R.id.autoMiss, it.optBoolean("autoMiss") ? View.VISIBLE : View.GONE);

        return new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_hadir)
            .setColor(fg)
            .setContentTitle(it.optString("title"))
            .setContentText(it.optString("body"))
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small)
            .setCustomHeadsUpContentView(small)
            .setCustomBigContentView(big)
            .setContentIntent(openIntent(ctx, id, it.optString("route")))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build();
    }

    /** "●●○○○○  1/6": absences so far in the course colour, the rest faint. */
    private static CharSequence dots(int missed, int limit, int fg) {
        SpannableStringBuilder sb = new SpannableStringBuilder();
        if (limit > 0 && limit <= 12) {
            for (int i = 0; i < limit; i++) {
                int start = sb.length();
                sb.append(i < missed ? "●" : "○");
                sb.setSpan(new ForegroundColorSpan(i < missed ? fg : 0x59FFFFFF), start, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            sb.append("  ");
        }
        int start = sb.length();
        sb.append(missed + "/" + limit + " missed");
        sb.setSpan(new ForegroundColorSpan(0xB3FFFFFF), start, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return sb;
    }

    private static Notification warning(Context ctx, JSONObject it) {
        int id = it.optInt("id");
        String body = it.optString("body");
        return new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_hadir)
            .setColor(Color.parseColor("nudge".equals(it.optString("kind")) ? "#48DE7C" : "#FF6B6B"))
            .setContentTitle(it.optString("title"))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openIntent(ctx, id, it.optString("route")))
            .setAutoCancel(true)
            .build();
    }

    private static PendingIntent answerIntent(Context ctx, int id, String sessionId, String mark) {
        Intent i = new Intent(ctx, PromptReceiver.class)
            .setAction(PromptReceiver.ANSWER)
            .setData(Uri.parse("prompt://answer/" + id + "/" + mark))
            .putExtra("id", id)
            .putExtra("sessionId", sessionId)
            .putExtra("mark", mark);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent openIntent(Context ctx, int id, String route) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setData(Uri.parse("prompt://open/" + id))
            .putExtra(MainActivity.EXTRA_ROUTE, route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
