# Hadir (Class Tracker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sideloaded Android app that pulls an IIUM student's timetable from i-Ma'luum, asks "Did you attend?" after every class, tracks absences against the bar limit, and tracks assignments with reminders.

**Architecture:** Capacitor 8 wraps a Vite + Preact + TypeScript UI. All logic that matters (session generation, attendance stats, notification planning, state transitions, HTML parsing) is pure TypeScript under `src/domain` and `src/iium/parser.ts`, unit-tested with Vitest. Thin adapters talk to Capacitor plugins (Preferences for storage, LocalNotifications, Filesystem/Share) and to one small Java plugin (`HadirPlugin`) that runs IIUM's CAS login in a native WebView and hands back the i-Ma'luum session cookie. No backend.

**Tech Stack:** Node 24 + JDK 21 (via mise), Android SDK platform 36, Capacitor 8, Vite 8, Preact 10, TypeScript, Vitest 5 + happy-dom, @fontsource (Libre Baskerville, Manrope).

**Spec:** `docs/superpowers/specs/2026-10-05-class-tracker-design.md`


> **Revision 2026-10-05 (after device test, user-approved):** the in-app CAS login worked, but i-Ma'luum's schedule page loads its data by JavaScript and returns HTTP 403 to non-browser requests. The timetable now comes from the Course Registration Confirmation Slip PDF (spec §4). Tasks 2 and 5 (CAS spike, HTML parser) are superseded: `HadirPlugin.casLogin/clearCookies`, the HTML parser and `tests/fixtures/schedule.html` were removed; `src/iium/parser.ts` now holds `groupRows`/`parseSlip`/`parseTimeRange`, `src/iium/pdf.ts` reads the PDF with pdf.js, and `readSlip(file)` in `src/iium/sync.ts` replaces `fetchTimetable()`. The "Unlink account" row is gone. Task 16's "link IIUM" check becomes "import the slip PDF".

## Global Constraints

- Run every command from the project root `/home/awk/Projects/Courses`, prefixed with `mise x --` (mise pins Node 24 and Temurin JDK 21; the system Node is 22 and too old for Capacitor 8).
- App id `com.awk.hadir`, app name `Hadir`. Java package `com.awk.hadir`.
- Capacitor 8.x, `compileSdk`/`targetSdk` 36, `minSdk` 24 (Capacitor defaults). Device: Nothing Phone 2, Android 16.
- Times are local; the phone is in Asia/Kuala_Lumpur. Tests run with `TZ=Asia/Kuala_Lumpur` (set in the `test` script).
- The app's JavaScript never sees the IIUM password. Login happens on IIUM's page inside `HadirPlugin`.
- `absenceLimit` default **6** = the absence count that bars you. Can still miss = `max(0, limit − 1 − missed)`. Risk: amber at `limit − 2`, red at `limit − 1`, "Barred" at `≥ limit`.
- Unanswered classes are never auto-counted as missed.
- Color tokens (exact): bg `#0B0C0E`, surface `#131416`, border `#1E1F21`, accent `#48DE7C`, accent-dim `#15331F`, hero `#0C1B14`, text `#F2F2F2`, text-muted `#7C7D7F`, danger `#E9777C` on `#3A1416`, missed `#6B2E30`, warn `#F5B53D`.
- Fonts: Libre Baskerville 700 for display/headings, Manrope 400/600/700 for UI. Bundled, never loaded from the network.
- Persisted state is one JSON document with `version: 1` under Preferences key `hadir-state`.

## Review Focus

1. **Pausing after today's classes were already answered** — answered sessions must stay (counts must not drop). Test: Task 3 "skips paused days but keeps sessions already marked".
2. **Re-syncing mid-semester** — semester start, marks, course colors and limits must survive; a course that vanished from i-Ma'luum must be hidden, not deleted. Test: Task 6 "re-sync in the same semester keeps…".
3. **Afternoon times written without 24h clock (`200 - 320`)** — must become 14:00–15:20, not 02:00. Test: Task 5 "treats hours before 8 as afternoon".
4. **Opening the app many times** — re-scheduling must replace, never duplicate prompts. Test: Task 7 "gives stable, unique ids…".
5. **Importing a bad or future-version backup** — must be rejected with a message and leave current data untouched. Test: Task 6 `parseImport` rejection tests; Settings only dispatches after a successful parse.

---

## File Structure

```
mise.toml                         toolchain pins + ANDROID_HOME
package.json, tsconfig.json, vite.config.ts, index.html, capacitor.config.ts
assets/                           app icon sources (Task 15)
tests/fixtures/schedule.html      synthetic i-Ma'luum schedule page (committed)
tests/fixtures/real-schedule.html real page pulled from phone (gitignored, Task 2)
src/
  main.tsx                        entry: fonts, css, render, boot
  boot.ts                         load state, wire notifications ↔ store
  app.tsx                         router shell, onboarding gate, load-error screen, back button
  domain/                         PURE logic, no Capacitor imports
    types.ts                      AppState & friends, defaults
    time.ts                       ymd/atTime/addDays helpers
    sessions.ts                   slots + semester + pauses + marks → Session[]
    attendance.ts                 riskOf, courseStats (counts, streaks)
    actions.ts                    state transitions, applySync, import/export
    planner.ts                    notifications to schedule, warning text
    testState.ts                  test fixtures (imported by tests only)
  iium/
    parser.ts                     i-Ma'luum schedule HTML → ParsedSchedule
    sync.ts                       login → fetch → parse
  native/
    hadir.ts, hadir.web.ts        HadirPlugin bridge + browser stub
    device.ts                     permission status + settings shortcuts
    share.ts                      write file + share sheet
  notify/notify.ts                LocalNotifications adapter
  store/store.ts                  in-memory state + Preferences persistence + hooks
  dev/seed.ts                     browser-only demo data (?seed)
  ui/
    theme.css, palette.ts, format.ts, router.ts, useNow.ts, useSync.ts, usePermissions.ts
    components/  icons.tsx TabBar.tsx Sheet.tsx Meter.tsx Toggle.tsx LinkCard.tsx
                 TaskRow.tsx TaskSheet.tsx SessionGrid.tsx SyncParts.tsx PermissionRows.tsx
    screens/     Home.tsx Schedule.tsx Tasks.tsx Courses.tsx CourseDetail.tsx Settings.tsx Onboarding.tsx
android/app/src/main/java/com/awk/hadir/HadirPlugin.java, MainActivity.java
android/app/src/main/res/drawable/ic_stat_hadir.xml
```

---

### Task 1: Toolchain and web scaffold

**Files:**
- Create: `mise.toml`, `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/tz.test.ts`

**Interfaces:**
- Produces: `npm run dev | build | test`, working Vitest in Asia/Kuala_Lumpur TZ, Android SDK at `~/Android/Sdk`.

- [ ] **Step 1: Pin toolchain**

`mise.toml`:
```toml
[tools]
node = "24"
java = "temurin-21"

[env]
ANDROID_HOME = "{{env.HOME}}/Android/Sdk"
_.path = ["{{env.HOME}}/Android/Sdk/platform-tools", "{{env.HOME}}/Android/Sdk/cmdline-tools/latest/bin"]
```

Run: `mise trust && mise install && mise x -- node --version && mise x -- sh -c 'java -version 2>&1 | head -1; echo JAVA_HOME=$JAVA_HOME'`
Expected: `v24.x`, `openjdk version "21…"`, `JAVA_HOME` pointing into `~/.local/share/mise/installs/java/…`. If `JAVA_HOME` is empty, add `JAVA_HOME = "{{exec(command='mise where java')}}"` under `[env]` and re-run.

- [ ] **Step 2: Install Android SDK (no sudo)**

```bash
mkdir -p ~/Android/Sdk/cmdline-tools
curl -L -o /tmp/claude-cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
unzip -q /tmp/claude-cmdline-tools.zip -d ~/Android/Sdk/cmdline-tools && mv ~/Android/Sdk/cmdline-tools/cmdline-tools ~/Android/Sdk/cmdline-tools/latest && rm /tmp/claude-cmdline-tools.zip
yes | mise x -- sdkmanager --licenses >/dev/null
mise x -- sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
mise x -- adb version
```
Expected: `Android Debug Bridge version …`. (If the zip URL 404s, take the current `commandlinetools-linux-*_latest.zip` name from https://developer.android.com/studio#command-tools.)

- [ ] **Step 3: Create project files**

`.gitignore`:
```
node_modules/
dist/
tests/fixtures/real-*
*.log
```

`package.json`:
```json
{
  "name": "hadir",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "TZ=Asia/Kuala_Lumpur vitest run",
    "test:watch": "TZ=Asia/Kuala_Lumpur vitest",
    "apk": "npm run build && cap sync android && cd android && ./gradlew assembleDebug",
    "install:phone": "adb install -r android/app/build/outputs/apk/debug/app-debug.apk"
  }
}
```

Run: `mise x -- npm i preact@^10 && mise x -- npm i -D vite @preact/preset-vite typescript vitest happy-dom`

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "capacitor.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  test: { include: ["src/**/*.test.ts"] },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0B0C0E" />
    <title>Hadir</title>
  </head>
  <body style="background:#0B0C0E">
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { render } from "preact";

render(<h1 style="color:#48DE7C">Hadir</h1>, document.getElementById("app")!);
```

- [ ] **Step 4: Write the timezone guard test**

`src/tz.test.ts`:
```ts
import { expect, it } from "vitest";

it("tests run in Malaysia time", () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-480);
});
```

- [ ] **Step 5: Run tests and build**

Run: `mise x -- npm test && mise x -- npm run build`
Expected: 1 test passes; `dist/index.html` produced.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + Preact + Vitest with mise toolchain"
```

---

### Task 2: Android shell, HadirPlugin, and CAS login proof (DEVICE GATE)

This task proves the riskiest assumption: that we can log in on IIUM's CAS page in a native WebView and read i-Ma'luum's schedule with the captured cookie. **If Step 9 fails, stop and report to the user** (fallback per spec §4).

**Files:**
- Create: `capacitor.config.ts`, `src/native/hadir.ts`, `src/native/hadir.web.ts`, `android/app/src/main/java/com/awk/hadir/HadirPlugin.java`, `android/app/src/main/res/drawable/ic_stat_hadir.xml`
- Modify: `src/main.tsx` (temporary spike UI), `android/app/src/main/java/com/awk/hadir/MainActivity.java`, `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: `Hadir.casLogin(): Promise<{ cookie: string }>` (rejects with message `"cancelled"` on back/close), `Hadir.clearCookies(): Promise<void>`, `Hadir.isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>`, `Hadir.openBatterySettings(): Promise<void>`. `tests/fixtures/real-schedule.html` on the dev machine.

- [ ] **Step 1: Install Capacitor**

Run:
```bash
mise x -- npm i @capacitor/core @capacitor/android @capacitor/app @capacitor/preferences @capacitor/local-notifications @capacitor/filesystem @capacitor/share
mise x -- npm i -D @capacitor/cli
```

`capacitor.config.ts`:
```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.awk.hadir",
  appName: "Hadir",
  webDir: "dist",
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_hadir", iconColor: "#48DE7C" },
  },
};

export default config;
```

Run: `mise x -- npm run build && mise x -- npx cap add android`
Expected: `android/` created; `android/app/src/main/java/com/awk/hadir/MainActivity.java` exists.

- [ ] **Step 2: Write the Java plugin**

`android/app/src/main/java/com/awk/hadir/HadirPlugin.java`:
```java
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
```

Replace `android/app/src/main/java/com/awk/hadir/MainActivity.java`:
```java
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
```

`android/app/src/main/res/drawable/ic_stat_hadir.xml`:
```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M9,16.2L4.8,12l-1.4,1.4L9,19 21,7l-1.4,-1.4L9,16.2z"/>
</vector>
```

In `android/app/src/main/AndroidManifest.xml`, directly after the existing `<uses-permission android:name="android.permission.INTERNET" />` line add:
```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

- [ ] **Step 3: JS bridge**

`src/native/hadir.ts`:
```ts
import { registerPlugin } from "@capacitor/core";

export interface HadirPlugin {
  casLogin(): Promise<{ cookie: string }>;
  clearCookies(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  openBatterySettings(): Promise<void>;
}

export const Hadir = registerPlugin<HadirPlugin>("Hadir", {
  web: () => import("./hadir.web").then((m) => new m.HadirWeb()),
});
```

`src/native/hadir.web.ts`:
```ts
import { WebPlugin } from "@capacitor/core";
import type { HadirPlugin } from "./hadir";

export class HadirWeb extends WebPlugin implements HadirPlugin {
  async casLogin() {
    return { cookie: "dev" };
  }
  async clearCookies() {}
  async isIgnoringBatteryOptimizations() {
    return { value: true };
  }
  async openBatterySettings() {}
}
```

- [ ] **Step 4: Temporary spike UI**

Replace `src/main.tsx`:
```tsx
import { render } from "preact";
import { useState } from "preact/hooks";
import { CapacitorHttp } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Hadir } from "./native/hadir";

function Spike() {
  const [log, setLog] = useState("Tap the button and log in with your IIUM account.");
  async function run() {
    try {
      const { cookie } = await Hadir.casLogin();
      setLog(`Got cookie (${cookie.length} chars). Fetching schedule…`);
      const res = await CapacitorHttp.get({
        url: "https://imaluum.iium.edu.my/MyAcademic/schedule",
        headers: { Cookie: cookie },
        responseType: "text",
      });
      const html = String(res.data);
      await Filesystem.writeFile({ path: "schedule.html", data: html, directory: Directory.Data, encoding: Encoding.UTF8 });
      setLog(`HTTP ${res.status}, ${html.length} chars, table found: ${html.includes("table-hover")}. Saved schedule.html`);
    } catch (e) {
      setLog(`Failed: ${(e as Error).message}`);
    } finally {
      await Hadir.clearCookies();
    }
  }
  return (
    <div style="padding:48px 20px;color:#fff;background:#0B0C0E;min-height:100vh;font-family:sans-serif">
      <h1>Hadir spike</h1>
      <button style="padding:14px;font-size:16px" onClick={run}>Test IIUM login</button>
      <p>{log}</p>
    </div>
  );
}

render(<Spike />, document.getElementById("app")!);
```

- [ ] **Step 5: Build the APK**

Run: `mise x -- npm run apk`
Expected: `BUILD SUCCESSFUL`, file `android/app/build/outputs/apk/debug/app-debug.apk`.

- [ ] **Step 6: Connect the phone (user does this)**

Ask the user to: Settings → About phone → tap **Build number** 7 times → Settings → System → Developer options → enable **USB debugging** → plug in USB → accept the "Allow USB debugging" prompt.

Run: `mise x -- adb devices`
Expected: one device listed as `device` (not `unauthorized`).

- [ ] **Step 7: Install**

Run: `mise x -- npm run install:phone`
Expected: `Success`.

- [ ] **Step 8: User runs the spike**

Ask the user to open **Hadir**, tap **Test IIUM login**, log in on the IIUM page, and read the result text.

- [ ] **Step 9: Verify the gate**

Expected on screen: `HTTP 200, <N> chars, table found: true. Saved schedule.html`.
- `Failed: cancelled` → user backed out; retry.
- Cookie captured but `table found: false` or non-200 → pull the file anyway (Step 10) and inspect it before deciding; it may be a redirect/login page, meaning the cookie isn't the session cookie.
- WebView never returns (stays on IIUM pages) → note the final URL the user sees; `onPageFinished` host check needs adjusting.
If the gate cannot be passed, **stop and report to the user** with what was observed.

- [ ] **Step 10: Pull the real page for parser tests**

Run: `mise x -- adb exec-out run-as com.awk.hadir cat files/schedule.html > tests/fixtures/real-schedule.html && wc -c tests/fixtures/real-schedule.html`
Expected: same size as `<N>`. The file contains the user's personal data and is gitignored — do not commit it.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: android shell with Hadir plugin for IIUM CAS login"
```

---

### Task 3: Domain types, time helpers, session generation

**Files:**
- Create: `src/domain/types.ts`, `src/domain/time.ts`, `src/domain/sessions.ts`, `src/domain/testState.ts`
- Test: `src/domain/time.test.ts`, `src/domain/sessions.test.ts`

**Interfaces:**
- Produces (types): `Day`, `Mark`, `SessionStatus`, `Course`, `Slot`, `Task`, `PauseInterval`, `Settings`, `Account`, `Semester`, `AppState`, `Session`; constants `DEFAULT_LIMIT = 6`, `SEMESTER_DAYS = 98`, `PALETTE_SIZE = 8`, `DEFAULT_SETTINGS`; `emptyState(): AppState`.
- Produces (time): `ymd(d: Date): string`, `parseYmd(s: string): Date`, `addDays(s: string, n: number): string`, `atTime(date: string, hhmm: string): Date`, `hhmm(d: Date): string`.
- Produces (sessions): `isPausedOn(pauses: PauseInterval[], date: string): boolean`, `generateSessions(state: AppState, now: Date): Session[]` (sorted by start).
- Produces (tests only): `course(code, name, color?)`, `slot(courseId, day, start, end)`, `makeState(over?)`, `BICS_MON_1`.

- [ ] **Step 1: Types**

`src/domain/types.ts`:
```ts
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
export type Mark = "attended" | "missed";
export type SessionStatus = "upcoming" | "unmarked" | Mark;

export interface Course {
  id: string; // `${code}-${section}`
  code: string;
  name: string;
  section: string;
  color: number; // index into the course palette
  absenceLimit: number; // absences that bar you
  active: boolean; // false when dropped from i-Ma'luum on re-sync
}

export interface Slot {
  id: string; // `${courseId}-${day}-${start}`
  courseId: string;
  day: Day;
  start: string; // "HH:MM"
  end: string;
  venue: string;
  lecturer: string;
}

export interface Task {
  id: string;
  courseId: string | null;
  title: string;
  due: string; // ISO datetime
  note: string;
  done: boolean;
}

/** Inclusive YYYY-MM-DD range; `to: null` means still paused. */
export interface PauseInterval {
  from: string;
  to: string | null;
}

export interface Settings {
  promptDelayMin: number;
  taskReminderTime: string; // "HH:MM", day before due
  warningsEnabled: boolean;
}

export interface Account {
  name: string | null;
  matric: string | null;
  lastSync: string; // YYYY-MM-DD
}

export interface Semester {
  label: string;
  start: string;
  end: string;
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  account: Account | null;
  semester: Semester | null;
  courses: Course[];
  slots: Slot[];
  marks: Record<string, Mark>; // sessionId → mark
  tasks: Task[];
  pauses: PauseInterval[];
  settings: Settings;
}

export interface Session {
  id: string; // `${slotId}@${date}`
  slotId: string;
  courseId: string;
  date: string;
  start: Date;
  end: Date;
  status: SessionStatus;
}

export const DEFAULT_LIMIT = 6;
export const SEMESTER_DAYS = 98; // 14 weeks
export const PALETTE_SIZE = 8;

export const DEFAULT_SETTINGS: Settings = {
  promptDelayMin: 0,
  taskReminderTime: "20:00",
  warningsEnabled: true,
};

export function emptyState(): AppState {
  return {
    version: 1,
    onboarded: false,
    account: null,
    semester: null,
    courses: [],
    slots: [],
    marks: {},
    tasks: [],
    pauses: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
```

- [ ] **Step 2: Write failing time tests**

`src/domain/time.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { addDays, atTime, hhmm, ymd } from "./time";

describe("time helpers", () => {
  it("addDays crosses month ends", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
  it("addDays goes backwards", () => expect(addDays("2026-10-01", -1)).toBe("2026-09-30"));
  it("atTime builds a local date", () => expect(atTime("2026-10-05", "08:30")).toEqual(new Date(2026, 9, 5, 8, 30)));
  it("ymd and hhmm pad", () => {
    const d = new Date(2026, 0, 2, 3, 4);
    expect(ymd(d)).toBe("2026-01-02");
    expect(hhmm(d)).toBe("03:04");
  });
});
```

Run: `mise x -- npm test -- src/domain/time.test.ts`
Expected: FAIL (cannot find module `./time`).

- [ ] **Step 3: Implement time helpers**

`src/domain/time.ts`:
```ts
const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function atTime(date: string, time: string): Date {
  const d = parseYmd(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

Run: `mise x -- npm test -- src/domain/time.test.ts`
Expected: PASS.

- [ ] **Step 4: Test fixtures**

`src/domain/testState.ts`:
```ts
import { emptyState } from "./types";
import type { AppState, Course, Day, Slot } from "./types";

export function course(code: string, name: string, color = 0): Course {
  return { id: `${code}-1`, code, name, section: "1", color, absenceLimit: 6, active: true };
}

export function slot(courseId: string, day: Day, start: string, end: string): Slot {
  return { id: `${courseId}-${day}-${start}`, courseId, day, start, end, venue: "ICT LR 14", lecturer: "DR. X" };
}

/** Semester: Mon 2026-10-05 .. Sun 2026-10-18 (two weeks). BICS Mon+Wed 11:30, BIIT Tue 08:30. */
export function makeState(over: Partial<AppState> = {}): AppState {
  return {
    ...emptyState(),
    onboarded: true,
    semester: { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2026-10-18" },
    courses: [course("BICS 4350", "PRIVACY ENGINEERING", 0), course("BIIT 2301", "USER EXPERIENCE DESIGN", 1)],
    slots: [
      slot("BICS 4350-1", 1, "11:30", "12:50"),
      slot("BICS 4350-1", 3, "11:30", "12:50"),
      slot("BIIT 2301-1", 2, "08:30", "09:50"),
    ],
    ...over,
  };
}

export const BICS_MON_1 = "BICS 4350-1-1-11:30@2026-10-05";
```

- [ ] **Step 5: Write failing session tests**

`src/domain/sessions.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { generateSessions, isPausedOn } from "./sessions";
import { BICS_MON_1, makeState } from "./testState";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe("generateSessions", () => {
  it("creates one session per slot occurrence in the semester, sorted", () => {
    const s = generateSessions(makeState(), at(5, 7));
    expect(s.map((x) => x.id)).toEqual([
      "BICS 4350-1-1-11:30@2026-10-05",
      "BIIT 2301-1-2-08:30@2026-10-06",
      "BICS 4350-1-3-11:30@2026-10-07",
      "BICS 4350-1-1-11:30@2026-10-12",
      "BIIT 2301-1-2-08:30@2026-10-13",
      "BICS 4350-1-3-11:30@2026-10-14",
    ]);
    expect(s[0].start).toEqual(at(5, 11, 30));
    expect(s[0].end).toEqual(at(5, 12, 50));
  });

  it("is upcoming until the class ends, then unmarked", () => {
    const s = generateSessions(makeState(), at(6, 9));
    expect(s[0].status).toBe("unmarked");
    expect(s[1].status).toBe("upcoming"); // Tue 08:30-09:50 still running
  });

  it("uses the saved mark", () => {
    const s = generateSessions(makeState({ marks: { [BICS_MON_1]: "missed" } }), at(6, 9));
    expect(s[0].status).toBe("missed");
  });

  it("skips paused days but keeps sessions already marked", () => {
    const state = makeState({ pauses: [{ from: "2026-10-05", to: "2026-10-11" }], marks: { [BICS_MON_1]: "attended" } });
    expect(generateSessions(state, at(5, 7)).map((x) => x.id)).toEqual([
      BICS_MON_1,
      "BICS 4350-1-1-11:30@2026-10-12",
      "BIIT 2301-1-2-08:30@2026-10-13",
      "BICS 4350-1-3-11:30@2026-10-14",
    ]);
  });

  it("an open pause hides everything from its start", () => {
    expect(generateSessions(makeState({ pauses: [{ from: "2026-10-07", to: null }] }), at(5, 7))).toHaveLength(2);
  });

  it("ignores inactive courses", () => {
    const st = makeState();
    st.courses[1] = { ...st.courses[1], active: false };
    expect(generateSessions(st, at(5, 7)).every((x) => x.courseId === "BICS 4350-1")).toBe(true);
  });

  it("returns nothing without a semester", () => {
    expect(generateSessions(makeState({ semester: null }), at(5, 7))).toEqual([]);
  });
});

describe("isPausedOn", () => {
  it("treats from/to as inclusive", () => {
    const p = [{ from: "2026-10-05", to: "2026-10-06" }];
    expect(isPausedOn(p, "2026-10-04")).toBe(false);
    expect(isPausedOn(p, "2026-10-05")).toBe(true);
    expect(isPausedOn(p, "2026-10-06")).toBe(true);
    expect(isPausedOn(p, "2026-10-07")).toBe(false);
  });
});
```

Run: `mise x -- npm test -- src/domain/sessions.test.ts`
Expected: FAIL (cannot find module `./sessions`).

- [ ] **Step 6: Implement sessions**

`src/domain/sessions.ts`:
```ts
import type { AppState, PauseInterval, Session } from "./types";
import { addDays, atTime, parseYmd } from "./time";

export function isPausedOn(pauses: PauseInterval[], date: string): boolean {
  return pauses.some((p) => date >= p.from && (p.to === null || date <= p.to));
}

export function generateSessions(state: AppState, now: Date): Session[] {
  const sem = state.semester;
  if (!sem) return [];
  const active = new Set(state.courses.filter((c) => c.active).map((c) => c.id));
  const slots = state.slots.filter((s) => active.has(s.courseId));
  const out: Session[] = [];
  for (let date = sem.start; date <= sem.end; date = addDays(date, 1)) {
    const dow = parseYmd(date).getDay();
    const paused = isPausedOn(state.pauses, date);
    for (const slot of slots) {
      if (slot.day !== dow) continue;
      const id = `${slot.id}@${date}`;
      const mark = state.marks[id];
      if (paused && !mark) continue;
      const start = atTime(date, slot.start);
      const end = atTime(date, slot.end);
      out.push({ id, slotId: slot.id, courseId: slot.courseId, date, start, end, status: mark ?? (now < end ? "upcoming" : "unmarked") });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
```

- [ ] **Step 7: Run tests**

Run: `mise x -- npm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/domain && git commit -m "feat: domain types and session generation"
```

---

### Task 4: Attendance stats

**Files:**
- Create: `src/domain/attendance.ts`
- Test: `src/domain/attendance.test.ts`

**Interfaces:**
- Consumes: `Course`, `Session` (Task 3), `course()` fixture.
- Produces: `type Risk = "ok" | "warn" | "danger" | "barred"`, `riskOf(missed: number, limit: number): Risk`, `interface CourseStats { attended; missed; unmarked; limit; canStillMiss; risk; currentStreak; bestStreak }` (all numbers except `risk`), `courseStats(course: Course, sessions: Session[]): CourseStats` (expects sessions sorted by start).

- [ ] **Step 1: Write failing tests**

`src/domain/attendance.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { courseStats, riskOf } from "./attendance";
import { course } from "./testState";
import type { Session, SessionStatus } from "./types";

const C = course("BICS 4350", "X");

function seq(statuses: SessionStatus[], courseId = C.id): Session[] {
  return statuses.map((status, i) => ({
    id: `s${i}`,
    slotId: "x",
    courseId,
    date: "2026-10-05",
    start: new Date(2026, 9, 5 + i, 8),
    end: new Date(2026, 9, 5 + i, 9),
    status,
  }));
}

describe("riskOf (limit 6)", () => {
  it.each([
    [0, "ok"],
    [3, "ok"],
    [4, "warn"],
    [5, "danger"],
    [6, "barred"],
    [7, "barred"],
  ] as const)("%i missed → %s", (missed, risk) => expect(riskOf(missed, 6)).toBe(risk));
});

describe("courseStats", () => {
  it("counts and streaks, skipping unmarked", () => {
    const st = courseStats(C, seq(["attended", "attended", "missed", "attended", "attended", "attended", "unmarked", "attended", "upcoming"]));
    expect(st).toEqual({ attended: 6, missed: 1, unmarked: 1, limit: 6, canStillMiss: 4, risk: "ok", currentStreak: 4, bestStreak: 4 });
  });

  it("current streak resets on the latest miss", () => {
    const st = courseStats(C, seq(["attended", "attended", "attended", "missed"]));
    expect(st.currentStreak).toBe(0);
    expect(st.bestStreak).toBe(3);
  });

  it("canStillMiss never goes negative", () => {
    const st = courseStats(C, seq(Array<SessionStatus>(7).fill("missed")));
    expect(st.canStillMiss).toBe(0);
    expect(st.risk).toBe("barred");
  });

  it("only counts its own course", () => {
    expect(courseStats(C, seq(["missed", "missed"], "OTHER-1")).missed).toBe(0);
  });
});
```

Run: `mise x -- npm test -- src/domain/attendance.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 2: Implement**

`src/domain/attendance.ts`:
```ts
import type { Course, Session } from "./types";

export type Risk = "ok" | "warn" | "danger" | "barred";

export interface CourseStats {
  attended: number;
  missed: number;
  unmarked: number;
  limit: number;
  canStillMiss: number;
  risk: Risk;
  currentStreak: number;
  bestStreak: number;
}

export function riskOf(missed: number, limit: number): Risk {
  if (missed >= limit) return "barred";
  if (missed >= limit - 1) return "danger";
  if (missed >= limit - 2) return "warn";
  return "ok";
}

/** `sessions` must be sorted by start time. Unmarked sessions don't break a streak. */
export function courseStats(course: Course, sessions: Session[]): CourseStats {
  let attended = 0;
  let missed = 0;
  let unmarked = 0;
  let current = 0;
  let best = 0;
  for (const s of sessions) {
    if (s.courseId !== course.id) continue;
    if (s.status === "attended") {
      attended++;
      current++;
      best = Math.max(best, current);
    } else if (s.status === "missed") {
      missed++;
      current = 0;
    } else if (s.status === "unmarked") {
      unmarked++;
    }
  }
  const limit = course.absenceLimit;
  return {
    attended,
    missed,
    unmarked,
    limit,
    canStillMiss: Math.max(0, limit - 1 - missed),
    risk: riskOf(missed, limit),
    currentStreak: current,
    bestStreak: best,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `mise x -- npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain && git commit -m "feat: attendance stats and risk levels"
```

---

### Task 5: i-Ma'luum schedule parser

**Files:**
- Create: `src/iium/parser.ts`, `tests/fixtures/schedule.html`
- Test: `src/iium/parser.test.ts`

**Interfaces:**
- Consumes: `Day` (Task 3).
- Produces: `interface ParsedCourse { code; name; section }`, `interface ParsedSlot { code; section; day: Day; start; end; venue; lecturer }`, `interface ParsedSchedule { sessionName: string; studentName: string | null; matric: string | null; courses: ParsedCourse[]; slots: ParsedSlot[] }`, `parseDays(text: string): Day[]`, `parseTimeRange(text: string): [string, string] | null`, `parseSchedule(html: string): ParsedSchedule`.

- [ ] **Step 1: Synthetic fixture**

Structure mirrors the selectors used by `nrmnqdds/imaluum-backend` (`.box-body table.table.table-hover`, 9-column course rows, 4-column continuation rows) and AdminLTE's user panel.

`tests/fixtures/schedule.html`:
```html
<html><body>
<header class="main-header"><nav class="navbar"><ul class="nav"><li class="dropdown user user-menu"><ul class="dropdown-menu"><li class="user-header"><p>ABDUL WAHID BIN EXAMPLE</p></li></ul></li></ul></nav></header>
<aside class="main-sidebar"><div class="user-panel"><div class="info"><p>ABDUL WAHID BIN EXAMPLE</p><small>2212345</small></div></div></aside>
<div class="box box-primary">
  <div class="box-header with-border">
    <div class="dropdown"><a class="dropdown-toggle" href="#">Sem 1, 2026/2027 <span class="caret"></span></a>
      <ul class="dropdown-menu"><li style="font-size:16px"><a href="?ses=2026/2027&amp;sem=1">Sem 1, 2026/2027</a></li></ul>
    </div>
  </div>
  <div class="box-body">
    <table class="table table-hover">
      <tr><th>Course Code</th><th>Course Title</th><th>Section</th><th>Credit Hour</th><th>Status</th><th>Day</th><th>Time</th><th>Venue</th><th>Lecturer</th></tr>
      <tr><td>BICS 4350</td><td>PRIVACY ENGINEERING</td><td>1</td><td>3</td><td>-</td><td>M-W</td><td>1130 - 1250</td><td>ICT LR 14 LEVEL 2D</td><td>DR. EXAMPLE ONE</td></tr>
      <tr><td>BIIT 2301</td><td>USER EXPERIENCE DESIGN</td><td>2</td><td>3</td><td>-</td><td>T-TH</td><td>830 - 950</td><td>ICT HCI LAB LEVEL 4C</td><td>DR. EXAMPLE TWO</td></tr>
      <tr><td>BICS 2304</td><td>SOFTWARE ENGINEERING</td><td>1</td><td>3</td><td>-</td><td>T</td><td>200 - 320</td><td>ICT LR 3</td><td>DR. EXAMPLE THREE</td></tr>
      <tr><td>TH</td><td>200 - 320</td><td>ICT LAB 2</td><td>DR. EXAMPLE THREE</td></tr>
      <tr><td>UNGS 1301</td><td>BASIC PHILOSOPHY AND ISLAMIC WORLDVIEW</td><td>5</td><td>3</td><td>-</td><td>MON - WED</td><td>0830 - 0950</td><td>KAED LR 1</td><td>USTAZ EXAMPLE</td></tr>
      <tr><td>ABCD 1000</td><td>NO TIME COURSE</td><td>1</td><td>0</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>
    </table>
  </div>
</div>
</body></html>
```

- [ ] **Step 2: Write failing tests**

`src/iium/parser.test.ts`:
```ts
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import html from "../../tests/fixtures/schedule.html?raw";
import { parseDays, parseSchedule, parseTimeRange } from "./parser";

const real = import.meta.glob("../../tests/fixtures/real-schedule.html", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const realHtml = Object.values(real)[0];

describe("parseDays", () => {
  it.each([
    ["M-W", [1, 3]],
    ["T-TH", [2, 4]],
    ["MON - WED", [1, 3]],
    ["TH", [4]],
    ["F", [5]],
    ["SAT", [6]],
    ["-", []],
  ] as const)("%s", (text, days) => expect(parseDays(text)).toEqual(days));
});

describe("parseTimeRange", () => {
  it("parses 24h ranges", () => expect(parseTimeRange("1130 - 1250")).toEqual(["11:30", "12:50"]));
  it("pads 3-digit morning times", () => expect(parseTimeRange("830-950")).toEqual(["08:30", "09:50"]));
  it("treats hours before 8 as afternoon", () => expect(parseTimeRange("200 - 320")).toEqual(["14:00", "15:20"]));
  it("rejects junk", () => {
    expect(parseTimeRange("-")).toBeNull();
    expect(parseTimeRange("TBA")).toBeNull();
  });
});

describe("parseSchedule (fixture)", () => {
  const p = parseSchedule(html);

  it("reads semester, name and matric", () => {
    expect(p.sessionName).toBe("Sem 1, 2026/2027");
    expect(p.studentName).toBe("ABDUL WAHID BIN EXAMPLE");
    expect(p.matric).toBe("2212345");
  });

  it("reads every course row, including ones without a time", () => {
    expect(p.courses.map((c) => c.code)).toEqual(["BICS 4350", "BIIT 2301", "BICS 2304", "UNGS 1301", "ABCD 1000"]);
  });

  it("expands multi-day rows and continuation rows into slots", () => {
    expect(p.slots).toHaveLength(8);
    expect(p.slots.filter((s) => s.code === "BICS 2304")).toEqual([
      { code: "BICS 2304", section: "1", day: 2, start: "14:00", end: "15:20", venue: "ICT LR 3", lecturer: "DR. EXAMPLE THREE" },
      { code: "BICS 2304", section: "1", day: 4, start: "14:00", end: "15:20", venue: "ICT LAB 2", lecturer: "DR. EXAMPLE THREE" },
    ]);
  });

  it("returns no courses for a page without the table (e.g. the login page)", () => {
    expect(parseSchedule("<html><body><form id='fm1'></form></body></html>").courses).toEqual([]);
  });
});

describe.skipIf(!realHtml)("parseSchedule (real i-Ma'luum page)", () => {
  it("finds courses and sane slots", () => {
    const p = parseSchedule(realHtml);
    console.table(p.slots);
    console.log({ sessionName: p.sessionName, studentName: p.studentName, matric: p.matric });
    expect(p.courses.length).toBeGreaterThan(0);
    expect(p.slots.length).toBeGreaterThan(0);
    for (const s of p.slots) expect(s.start < s.end).toBe(true);
  });
});
```

Run: `mise x -- npm test -- src/iium/parser.test.ts`
Expected: FAIL (cannot find module `./parser`).

- [ ] **Step 3: Implement the parser**

`src/iium/parser.ts`:
```ts
import type { Day } from "../domain/types";

export interface ParsedCourse {
  code: string;
  name: string;
  section: string;
}

export interface ParsedSlot {
  code: string;
  section: string;
  day: Day;
  start: string;
  end: string;
  venue: string;
  lecturer: string;
}

export interface ParsedSchedule {
  sessionName: string;
  studentName: string | null;
  matric: string | null;
  courses: ParsedCourse[];
  slots: ParsedSlot[];
}

const DAY_CODES: Record<string, Day> = {
  SUN: 0,
  M: 1, MON: 1,
  T: 2, TUE: 2, TUES: 2,
  W: 3, WED: 3,
  TH: 4, THU: 4, THUR: 4, THURS: 4,
  F: 5, FRI: 5,
  SAT: 6,
};

export function parseDays(text: string): Day[] {
  return text
    .toUpperCase()
    .replace(/\s+/g, "")
    .split("-")
    .map((part) => DAY_CODES[part])
    .filter((d): d is Day => d !== undefined);
}

function toHHMM(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 4) return null;
  let h = Number(digits.slice(0, -2));
  const m = Number(digits.slice(-2));
  if (h > 23 || m > 59) return null;
  if (h < 8) h += 12; // i-Ma'luum may write 2:30pm as "230"
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTimeRange(text: string): [string, string] | null {
  const parts = text.split("-");
  if (parts.length !== 2) return null;
  const start = toHHMM(parts[0]);
  const end = toHHMM(parts[1]);
  return start && end ? [start, end] : null;
}

const clean = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

export function parseSchedule(html: string): ParsedSchedule {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const courses = new Map<string, ParsedCourse>();
  const slots: ParsedSlot[] = [];
  let last: ParsedCourse | null = null;

  for (const row of Array.from(doc.querySelectorAll(".box-body table.table.table-hover tr"))) {
    const tds = Array.from(row.querySelectorAll("td"));
    let course: ParsedCourse;
    let cells: string[];
    if (tds.length === 9) {
      course = { code: clean(tds[0]), name: clean(tds[1]), section: clean(tds[2]) };
      courses.set(`${course.code}-${course.section}`, course);
      last = course;
      cells = [tds[5], tds[6], tds[7], tds[8]].map(clean);
    } else if (tds.length === 4 && last) {
      course = last;
      cells = tds.map(clean);
    } else {
      continue;
    }
    const [dayText, timeText, venue, lecturer] = cells;
    const time = parseTimeRange(timeText);
    if (!time) continue;
    for (const day of parseDays(dayText)) {
      slots.push({ code: course.code, section: course.section, day, start: time[0], end: time[1], venue, lecturer });
    }
  }

  const sessionName =
    clean(doc.querySelector(".box-header.with-border .dropdown-toggle") ?? doc.querySelector(".box-header.with-border .box-title")) ||
    "Current semester";
  const profile = clean(doc.querySelector(".user-panel .info") ?? doc.querySelector(".user-header"));
  const studentName = clean(doc.querySelector(".user-panel .info p") ?? doc.querySelector(".user-header p")).replace(/\b\d{7}\b/, "").trim() || null;
  const matric = profile.match(/\b\d{7}\b/)?.[0] ?? null;

  return { sessionName, studentName, matric, courses: [...courses.values()], slots };
}
```

- [ ] **Step 4: Run tests**

Run: `mise x -- npm test -- src/iium/parser.test.ts`
Expected: fixture tests PASS. If `tests/fixtures/real-schedule.html` exists (Task 2), the real-page test also runs and prints a slot table.

- [ ] **Step 5: Check against the real page**

If the real-page test fails or prints `sessionName: "Current semester"`, `studentName: null`, or `matric: null`, inspect the real markup:

Run: `grep -n -i -E 'table-hover|dropdown-toggle|box-title|user-panel|user-header|hidden-xs' tests/fixtures/real-schedule.html | head -40`

Adjust only the selectors in `parseSchedule` (and the synthetic fixture so it mirrors the real structure) until both fixture and real tests pass. Compare the printed slot table with the user's actual timetable (e.g. Aurum screenshot `references/calendar-view.jpeg`: BICS 4350 Mon/Wed 11:30–12:50).

Run: `mise x -- npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/iium tests/fixtures/schedule.html && git commit -m "feat: parse i-Ma'luum schedule page"
```

---

### Task 6: State transitions, sync merge, import/export

**Files:**
- Create: `src/domain/actions.ts`
- Test: `src/domain/actions.test.ts`

**Interfaces:**
- Consumes: types + `addDays` (Task 3), `ParsedSchedule` (Task 5), `generateSessions` (tests).
- Produces:
  - `courseKey(code: string, section: string): string`
  - `markSession(state, sessionId: string, mark: Mark): AppState`
  - `isPaused(state): boolean`, `setPaused(state, paused: boolean, today: string): AppState`
  - `upsertTask(state, task: Task)`, `deleteTask(state, id)`, `toggleTask(state, id)`
  - `updateSettings(state, patch: Partial<Settings>)`, `setSemesterEnd(state, end: string)`, `completeOnboarding(state)`, `unlink(state)`
  - `applySync(state, parsed: ParsedSchedule, today: string): AppState`
  - `serialize(state): string`, `parseImport(json: string): AppState` (throws `Error` with user-facing message)

- [ ] **Step 1: Write failing tests**

`src/domain/actions.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  applySync, deleteTask, isPaused, markSession, parseImport, serialize, setPaused, toggleTask, upsertTask,
} from "./actions";
import { generateSessions } from "./sessions";
import { BICS_MON_1, makeState } from "./testState";
import { emptyState } from "./types";
import type { AppState, Task } from "./types";
import type { ParsedSchedule } from "../iium/parser";

const parsed = (over: Partial<ParsedSchedule> = {}): ParsedSchedule => ({
  sessionName: "Sem 1, 2026/2027",
  studentName: "ABDUL WAHID",
  matric: "2212345",
  courses: [
    { code: "BICS 4350", name: "PRIVACY ENGINEERING", section: "1" },
    { code: "BIIT 2301", name: "USER EXPERIENCE DESIGN", section: "1" },
  ],
  slots: [
    { code: "BICS 4350", section: "1", day: 1, start: "11:30", end: "12:50", venue: "ICT LR 14", lecturer: "DR. X" },
    { code: "BICS 4350", section: "1", day: 1, start: "11:30", end: "12:50", venue: "ICT LR 14", lecturer: "DR. X" },
    { code: "BIIT 2301", section: "1", day: 2, start: "08:30", end: "09:50", venue: "HCI LAB", lecturer: "DR. Y" },
  ],
  ...over,
});

describe("markSession", () => {
  it("stores the mark", () => {
    expect(markSession(makeState(), BICS_MON_1, "missed").marks[BICS_MON_1]).toBe("missed");
  });
});

describe("setPaused", () => {
  it("opens and closes a pause interval", () => {
    const p = setPaused(makeState(), true, "2026-10-07");
    expect(isPaused(p)).toBe(true);
    expect(p.pauses).toEqual([{ from: "2026-10-07", to: null }]);
    const r = setPaused(p, false, "2026-10-12");
    expect(isPaused(r)).toBe(false);
    expect(r.pauses).toEqual([{ from: "2026-10-07", to: "2026-10-11" }]);
  });

  it("pausing and resuming on the same day hides nothing", () => {
    const st = setPaused(setPaused(makeState(), true, "2026-10-05"), false, "2026-10-05");
    expect(generateSessions(st, new Date(2026, 9, 5, 7))).toHaveLength(6);
  });

  it("is a no-op when already in that state", () => {
    const s = makeState();
    expect(setPaused(s, false, "2026-10-05")).toBe(s);
  });
});

describe("applySync", () => {
  it("first sync creates courses, deduped slots, semester and account", () => {
    const s = applySync(emptyState(), parsed(), "2026-10-05");
    expect(s.courses.map((c) => [c.id, c.color, c.absenceLimit, c.active])).toEqual([
      ["BICS 4350-1", 0, 6, true],
      ["BIIT 2301-1", 1, 6, true],
    ]);
    expect(s.slots.map((x) => x.id)).toEqual(["BICS 4350-1-1-11:30", "BIIT 2301-1-2-08:30"]);
    expect(s.semester).toEqual({ label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2027-01-11" });
    expect(s.account).toEqual({ name: "ABDUL WAHID", matric: "2212345", lastSync: "2026-10-05" });
  });

  it("re-sync in the same semester keeps start date, marks, colors and hides dropped courses", () => {
    const first = markSession(applySync(emptyState(), parsed(), "2026-10-05"), BICS_MON_1, "missed");
    const again = applySync(
      first,
      parsed({ courses: [parsed().courses[0]], slots: [parsed().slots[0]], studentName: null }),
      "2026-10-20",
    );
    expect(again.semester?.start).toBe("2026-10-05");
    expect(again.marks[BICS_MON_1]).toBe("missed");
    expect(again.courses.find((c) => c.id === "BICS 4350-1")).toMatchObject({ color: 0, active: true });
    expect(again.courses.find((c) => c.id === "BIIT 2301-1")).toMatchObject({ active: false });
    expect(again.account).toEqual({ name: "ABDUL WAHID", matric: "2212345", lastSync: "2026-10-20" });
  });

  it("a new semester label starts a new semester", () => {
    const s = applySync(applySync(emptyState(), parsed(), "2026-10-05"), parsed({ sessionName: "Sem 2, 2026/2027" }), "2027-03-01");
    expect(s.semester).toMatchObject({ label: "Sem 2, 2026/2027", start: "2027-03-01" });
  });
});

describe("tasks", () => {
  const t: Task = { id: "t1", courseId: null, title: "Lab 1", due: "2026-10-07T15:59:00.000Z", note: "", done: false };

  it("upsert adds then replaces", () => {
    const b = upsertTask(upsertTask(makeState(), t), { ...t, title: "Lab 1 v2" });
    expect(b.tasks).toEqual([{ ...t, title: "Lab 1 v2" }]);
  });

  it("toggle and delete", () => {
    const a = toggleTask(upsertTask(makeState(), t), "t1");
    expect(a.tasks[0].done).toBe(true);
    expect(deleteTask(a, "t1").tasks).toEqual([]);
  });
});

describe("serialize / parseImport", () => {
  it("round-trips", () => {
    const s = markSession(makeState(), BICS_MON_1, "attended");
    expect(parseImport(serialize(s))).toEqual(s);
  });
  it("rejects non-JSON", () => expect(() => parseImport("not json")).toThrow("Not a valid backup file"));
  it("rejects other versions", () => {
    expect(() => parseImport(JSON.stringify({ ...makeState(), version: 2 }))).toThrow("Unsupported data version: 2");
  });
  it("rejects files missing data", () => expect(() => parseImport(JSON.stringify({ version: 1 }))).toThrow("Backup file is missing data"));
  it("fills in settings added later", () => {
    const old: Partial<AppState> = { ...makeState() };
    delete old.settings;
    expect(parseImport(JSON.stringify(old)).settings).toEqual(emptyState().settings);
  });
});
```

Run: `mise x -- npm test -- src/domain/actions.test.ts`
Expected: FAIL (cannot find module `./actions`).

- [ ] **Step 2: Implement**

`src/domain/actions.ts`:
```ts
import { DEFAULT_LIMIT, DEFAULT_SETTINGS, PALETTE_SIZE, SEMESTER_DAYS, emptyState } from "./types";
import type { AppState, Course, Mark, Settings, Slot, Task } from "./types";
import { addDays } from "./time";
import type { ParsedSchedule } from "../iium/parser";

export const courseKey = (code: string, section: string) => `${code}-${section}`;

export function markSession(state: AppState, sessionId: string, mark: Mark): AppState {
  return { ...state, marks: { ...state.marks, [sessionId]: mark } };
}

export function isPaused(state: AppState): boolean {
  return state.pauses.some((p) => p.to === null);
}

/** Pausing starts today; resuming ends the pause yesterday so today's classes come back. */
export function setPaused(state: AppState, paused: boolean, today: string): AppState {
  if (paused === isPaused(state)) return state;
  if (paused) return { ...state, pauses: [...state.pauses, { from: today, to: null }] };
  return { ...state, pauses: state.pauses.map((p) => (p.to === null ? { ...p, to: addDays(today, -1) } : p)) };
}

export function upsertTask(state: AppState, task: Task): AppState {
  const exists = state.tasks.some((t) => t.id === task.id);
  return { ...state, tasks: exists ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task] };
}

export function deleteTask(state: AppState, id: string): AppState {
  return { ...state, tasks: state.tasks.filter((t) => t.id !== id) };
}

export function toggleTask(state: AppState, id: string): AppState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) };
}

export function updateSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function setSemesterEnd(state: AppState, end: string): AppState {
  return state.semester ? { ...state, semester: { ...state.semester, end } } : state;
}

export const completeOnboarding = (state: AppState): AppState => ({ ...state, onboarded: true });

/** Forget the account but keep all courses, attendance and tasks. */
export const unlink = (state: AppState): AppState => ({ ...state, account: null });

export function applySync(state: AppState, parsed: ParsedSchedule, today: string): AppState {
  const previous = new Map(state.courses.map((c) => [c.id, c]));
  let nextColor = state.courses.length;
  const synced: Course[] = parsed.courses.map((p) => {
    const id = courseKey(p.code, p.section);
    const prev = previous.get(id);
    return {
      id,
      code: p.code,
      name: p.name,
      section: p.section,
      color: prev?.color ?? nextColor++ % PALETTE_SIZE,
      absenceLimit: prev?.absenceLimit ?? DEFAULT_LIMIT,
      active: true,
    };
  });
  const syncedIds = new Set(synced.map((c) => c.id));
  const dropped = state.courses.filter((c) => !syncedIds.has(c.id)).map((c) => ({ ...c, active: false }));

  const slots = new Map<string, Slot>();
  for (const s of parsed.slots) {
    const courseId = courseKey(s.code, s.section);
    const id = `${courseId}-${s.day}-${s.start}`;
    slots.set(id, { id, courseId, day: s.day, start: s.start, end: s.end, venue: s.venue, lecturer: s.lecturer });
  }

  const sameSemester = state.semester?.label === parsed.sessionName;
  return {
    ...state,
    courses: [...synced, ...dropped],
    slots: [...slots.values()],
    semester: sameSemester ? state.semester : { label: parsed.sessionName, start: today, end: addDays(today, SEMESTER_DAYS) },
    account: {
      name: parsed.studentName ?? state.account?.name ?? null,
      matric: parsed.matric ?? state.account?.matric ?? null,
      lastSync: today,
    },
  };
}

export function serialize(state: AppState): string {
  return JSON.stringify(state);
}

export function parseImport(json: string): AppState {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Not a valid backup file");
  }
  if (typeof data !== "object" || data === null) throw new Error("Not a valid backup file");
  const obj = data as Partial<AppState> & { version?: unknown };
  if (obj.version !== 1) throw new Error(`Unsupported data version: ${String(obj.version)}`);
  if (!Array.isArray(obj.courses) || !Array.isArray(obj.slots) || !Array.isArray(obj.tasks) || typeof obj.marks !== "object" || obj.marks === null) {
    throw new Error("Backup file is missing data");
  }
  return {
    ...emptyState(),
    ...obj,
    pauses: Array.isArray(obj.pauses) ? obj.pauses : [],
    settings: { ...DEFAULT_SETTINGS, ...obj.settings },
  } as AppState;
}
```

- [ ] **Step 3: Run tests**

Run: `mise x -- npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain && git commit -m "feat: state actions, sync merge, backup import/export"
```

---

### Task 7: Notification planner

**Files:**
- Create: `src/domain/planner.ts`
- Test: `src/domain/planner.test.ts`

**Interfaces:**
- Consumes: `generateSessions` (Task 3), time helpers, `Course`.
- Produces: `interface Planned { id: number; at: Date; kind: "attendance" | "task"; title: string; body: string; route: string; sessionId?: string }`, `notifId(key: string): number` (1..2³¹−1), `planNotifications(state: AppState, now: Date, horizonDays = 14): Planned[]` (sorted by `at`), `warningFor(course: Course, missedBefore: number, missedAfter: number): string | null`.

- [ ] **Step 1: Write failing tests**

`src/domain/planner.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { notifId, planNotifications, warningFor } from "./planner";
import { BICS_MON_1, course, makeState } from "./testState";
import { DEFAULT_SETTINGS } from "./types";
import type { Task } from "./types";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe("planNotifications: attendance", () => {
  it("plans a prompt at the end of every future unmarked class", () => {
    const p = planNotifications(makeState(), at(5, 7)).filter((x) => x.kind === "attendance");
    expect(p).toHaveLength(6);
    expect(p[0]).toMatchObject({
      at: at(5, 12, 50),
      title: "Did you attend BICS 4350?",
      body: "PRIVACY ENGINEERING · ICT LR 14",
      sessionId: BICS_MON_1,
      route: "#/home",
    });
  });

  it("skips marked and already-prompted classes and honours the delay", () => {
    const st = makeState({
      marks: { "BIIT 2301-1-2-08:30@2026-10-06": "attended" },
      settings: { ...DEFAULT_SETTINGS, promptDelayMin: 10 },
    });
    const p = planNotifications(st, at(5, 13)).filter((x) => x.kind === "attendance");
    expect(p.map((x) => x.sessionId)).toEqual([
      "BICS 4350-1-3-11:30@2026-10-07",
      "BICS 4350-1-1-11:30@2026-10-12",
      "BIIT 2301-1-2-08:30@2026-10-13",
      "BICS 4350-1-3-11:30@2026-10-14",
    ]);
    expect(p[0].at).toEqual(at(7, 13, 0));
  });

  it("stops at the horizon", () => {
    expect(planNotifications(makeState(), at(5, 7), 3).filter((x) => x.kind === "attendance")).toHaveLength(3);
  });

  it("plans nothing while paused", () => {
    expect(planNotifications(makeState({ pauses: [{ from: "2026-10-05", to: null }] }), at(5, 7))).toEqual([]);
  });

  it("gives stable, unique ids so re-scheduling never duplicates", () => {
    const a = planNotifications(makeState(), at(5, 7));
    const b = planNotifications(makeState(), at(5, 8));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
    for (const x of a) {
      expect(Number.isInteger(x.id)).toBe(true);
      expect(x.id).toBeGreaterThan(0);
      expect(x.id).toBeLessThan(2 ** 31);
    }
  });
});

describe("planNotifications: tasks", () => {
  const task = (due: Date, done = false): Task => ({ id: "t1", courseId: "BICS 4350-1", title: "Lab report", due: due.toISOString(), note: "", done });

  it("reminds the day before at the reminder time", () => {
    const p = planNotifications(makeState({ semester: null, tasks: [task(at(9, 23, 59))] }), at(5, 7));
    expect(p).toEqual([
      { id: notifId("t:t1"), at: at(8, 20), kind: "task", title: "Due tomorrow: Lab report", body: "BICS 4350 · due 23:59", route: "#/tasks" },
    ]);
  });

  it("skips a reminder whose time already passed", () => {
    expect(planNotifications(makeState({ semester: null, tasks: [task(at(6, 10))] }), at(5, 21))).toEqual([]);
  });

  it("skips done tasks", () => {
    expect(planNotifications(makeState({ semester: null, tasks: [task(at(9, 10), true)] }), at(5, 7))).toEqual([]);
  });
});

describe("warningFor", () => {
  const c = course("BICS 4350", "X");
  it("warns one below the limit", () => expect(warningFor(c, 4, 5)).toBe("BICS 4350: 5 / 6 missed — one more and you're barred"));
  it("warns at the limit", () => expect(warningFor(c, 5, 6)).toBe("BICS 4350: 6 / 6 missed — you've reached the bar limit"));
  it("stays quiet otherwise", () => {
    expect(warningFor(c, 3, 4)).toBeNull();
    expect(warningFor(c, 5, 5)).toBeNull();
    expect(warningFor(c, 5, 4)).toBeNull();
  });
});
```

Run: `mise x -- npm test -- src/domain/planner.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 2: Implement**

`src/domain/planner.ts`:
```ts
import type { AppState, Course } from "./types";
import { generateSessions } from "./sessions";
import { addDays, atTime, hhmm, ymd } from "./time";

export interface Planned {
  id: number;
  at: Date;
  kind: "attendance" | "task";
  title: string;
  body: string;
  route: string;
  sessionId?: string;
}

/** FNV-1a → positive 31-bit int, stable across runs so re-scheduling replaces instead of duplicating. */
export function notifId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 1 || 1;
}

export function planNotifications(state: AppState, now: Date, horizonDays = 14): Planned[] {
  const nowMs = now.getTime();
  const horizon = nowMs + horizonDays * 86_400_000;
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const slots = new Map(state.slots.map((s) => [s.id, s]));
  const out: Planned[] = [];

  for (const s of generateSessions(state, now)) {
    if (state.marks[s.id]) continue;
    const at = new Date(s.end.getTime() + state.settings.promptDelayMin * 60_000);
    if (at.getTime() <= nowMs || at.getTime() > horizon) continue;
    const c = courses.get(s.courseId)!;
    const slot = slots.get(s.slotId)!;
    out.push({
      id: notifId(`a:${s.id}`),
      at,
      kind: "attendance",
      sessionId: s.id,
      title: `Did you attend ${c.code}?`,
      body: [c.name, slot.venue].filter(Boolean).join(" · "),
      route: "#/home",
    });
  }

  for (const t of state.tasks) {
    if (t.done) continue;
    const due = new Date(t.due);
    if (due.getTime() <= nowMs) continue;
    const at = atTime(addDays(ymd(due), -1), state.settings.taskReminderTime);
    if (at.getTime() <= nowMs || at.getTime() > horizon) continue;
    const code = t.courseId ? courses.get(t.courseId)?.code : undefined;
    out.push({
      id: notifId(`t:${t.id}`),
      at,
      kind: "task",
      title: `Due tomorrow: ${t.title}`,
      body: [code, `due ${hhmm(due)}`].filter(Boolean).join(" · "),
      route: "#/tasks",
    });
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function warningFor(course: Course, missedBefore: number, missedAfter: number): string | null {
  if (missedAfter <= missedBefore) return null;
  const limit = course.absenceLimit;
  if (missedAfter >= limit && missedBefore < limit) return `${course.code}: ${missedAfter} / ${limit} missed — you've reached the bar limit`;
  if (missedAfter === limit - 1) return `${course.code}: ${missedAfter} / ${limit} missed — one more and you're barred`;
  return null;
}
```

- [ ] **Step 3: Run tests**

Run: `mise x -- npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/domain && git commit -m "feat: notification planner and absence warnings"
```

---

### Task 8: Store, notifications adapter, sync, device helpers, boot

Thin adapters over Capacitor plugins; logic stays in the tested domain code. Verified by type-check and, later, the device run.

**Files:**
- Create: `src/store/store.ts`, `src/notify/notify.ts`, `src/iium/sync.ts`, `src/native/device.ts`, `src/native/share.ts`, `src/boot.ts`, `src/dev/seed.ts`

**Interfaces:**
- Consumes: domain (Tasks 3–7), `parseSchedule` (Task 5), `Hadir` (Task 2).
- Produces:
  - store: `loadState(): Promise<void>`, `getState(): AppState`, `dispatch(fn: (s: AppState) => AppState): void`, `onStateChange(h: (prev, next) => void)`, `useAppState(): AppState`, `useLoadStatus(): { loaded: boolean; error: string | null; raw: string | null }`
  - notify: `initNotifications(onAction: (a: NotificationAction) => void)`, `reschedule(state, now?)`, `notifyNow(title, body, route)`, `isMark(id: string): id is Mark`, `interface NotificationAction { actionId: string; sessionId?: string; route?: string }`
  - sync: `SCHEDULE_URL`, `CANCELLED = "cancelled"`, `class SyncError extends Error { html?: string }`, `fetchTimetable(): Promise<ParsedSchedule>`
  - device: `interface PermissionStatus { notifications: boolean; exactAlarms: boolean; battery: boolean }`, `getPermissions()`, `requestNotifications()`, `openExactAlarmSettings()`, `openBatterySettings()`
  - share: `shareFile(name: string, text: string, mime?: string): Promise<void>`
  - boot: `boot(): Promise<void>`
  - seed: `seedState(now: Date): AppState`

- [ ] **Step 1: Store**

`src/store/store.ts`:
```ts
import { Preferences } from "@capacitor/preferences";
import { useEffect, useState } from "preact/hooks";
import { emptyState } from "../domain/types";
import type { AppState } from "../domain/types";
import { parseImport, serialize } from "../domain/actions";

const KEY = "hadir-state";
type ChangeHook = (prev: AppState, next: AppState) => void;
interface LoadStatus {
  loaded: boolean;
  error: string | null;
  raw: string | null;
}

let state: AppState = emptyState();
let status: LoadStatus = { loaded: false, error: null, raw: null };
const listeners = new Set<() => void>();
const hooks: ChangeHook[] = [];

const emit = () => listeners.forEach((l) => l());

export async function loadState(): Promise<void> {
  const { value } = await Preferences.get({ key: KEY });
  if (value) {
    try {
      state = parseImport(value);
    } catch (e) {
      status = { loaded: true, error: (e as Error).message, raw: value };
      emit();
      return;
    }
  }
  status = { loaded: true, error: null, raw: null };
  emit();
}

export const getState = () => state;

export function dispatch(fn: (s: AppState) => AppState): void {
  if (status.error) return; // never overwrite data we couldn't read
  const prev = state;
  const next = fn(prev);
  if (next === prev) return;
  state = next;
  emit();
  void Preferences.set({ key: KEY, value: serialize(next) });
  hooks.forEach((h) => h(prev, next));
}

export function onStateChange(hook: ChangeHook): void {
  hooks.push(hook);
}

function useSubscribe<T>(read: () => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return read();
}

export const useAppState = () => useSubscribe(() => state);
export const useLoadStatus = () => useSubscribe(() => status);
```

- [ ] **Step 2: Notifications adapter**

`src/notify/notify.ts`:
```ts
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AppState, Mark } from "../domain/types";
import { planNotifications } from "../domain/planner";

const ATTEND = "ATTEND";

export interface NotificationAction {
  actionId: string;
  sessionId?: string;
  route?: string;
}

export const isMark = (id: string): id is Mark => id === "attended" || id === "missed";

export async function initNotifications(onAction: (a: NotificationAction) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.registerActionTypes({
    types: [{ id: ATTEND, actions: [{ id: "attended", title: "Attended" }, { id: "missed", title: "Missed", destructive: true }] }],
  });
  await LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
    const extra = (e.notification.extra ?? {}) as { sessionId?: string; route?: string };
    onAction({ actionId: e.actionId, sessionId: extra.sessionId, route: extra.route });
  });
}

/** Cancel everything pending and schedule the next 14 days from scratch. */
export async function reschedule(state: AppState, now = new Date()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  const planned = planNotifications(state, now);
  if (!planned.length) return;
  await LocalNotifications.schedule({
    notifications: planned.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      schedule: { at: p.at, allowWhileIdle: true },
      actionTypeId: p.kind === "attendance" ? ATTEND : undefined,
      extra: { sessionId: p.sessionId, route: p.route },
    })),
  });
}

export async function notifyNow(title: string, body: string, route: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.schedule({
    notifications: [{ id: Math.floor(Math.random() * 1_000_000_000) + 1, title, body, extra: { route } }],
  });
}
```

- [ ] **Step 3: Sync**

`src/iium/sync.ts`:
```ts
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Hadir } from "../native/hadir";
import { parseSchedule } from "./parser";
import type { ParsedSchedule } from "./parser";

export const SCHEDULE_URL = "https://imaluum.iium.edu.my/MyAcademic/schedule";
export const CANCELLED = "cancelled";

export class SyncError extends Error {
  constructor(message: string, readonly html?: string) {
    super(message);
  }
}

async function fetchScheduleHtml(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return (await import("../../tests/fixtures/schedule.html?raw")).default;
  }
  const { cookie } = await Hadir.casLogin(); // rejects with "cancelled" if the user backs out
  try {
    const res = await CapacitorHttp.get({ url: SCHEDULE_URL, headers: { Cookie: cookie }, responseType: "text" });
    if (res.status !== 200) throw new SyncError(`i-Ma'luum returned HTTP ${res.status}`);
    return String(res.data);
  } finally {
    await Hadir.clearCookies();
  }
}

export async function fetchTimetable(): Promise<ParsedSchedule> {
  const html = await fetchScheduleHtml();
  const parsed = parseSchedule(html);
  if (parsed.courses.length === 0) throw new SyncError("Couldn't read your timetable from i-Ma'luum", html);
  return parsed;
}
```

- [ ] **Step 4: Device helpers and sharing**

`src/native/device.ts`:
```ts
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Hadir } from "./hadir";

export interface PermissionStatus {
  notifications: boolean;
  exactAlarms: boolean;
  battery: boolean;
}

export async function getPermissions(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) return { notifications: true, exactAlarms: true, battery: true };
  const [n, e, b] = await Promise.all([
    LocalNotifications.checkPermissions(),
    LocalNotifications.checkExactNotificationSetting(),
    Hadir.isIgnoringBatteryOptimizations(),
  ]);
  return { notifications: n.display === "granted", exactAlarms: e.exact_alarm === "granted", battery: b.value };
}

export const requestNotifications = () => LocalNotifications.requestPermissions();
export const openExactAlarmSettings = () => LocalNotifications.changeExactNotificationSetting();
export const openBatterySettings = () => Hadir.openBatterySettings();
```

`src/native/share.ts`:
```ts
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export async function shareFile(name: string, text: string, mime = "application/json"): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: name, files: [uri] });
}
```

- [ ] **Step 5: Dev seed data (browser only)**

`src/dev/seed.ts`:
```ts
import html from "../../tests/fixtures/schedule.html?raw";
import { applySync, markSession } from "../domain/actions";
import { generateSessions } from "../domain/sessions";
import { addDays, atTime, ymd } from "../domain/time";
import { emptyState } from "../domain/types";
import type { AppState, Task } from "../domain/types";
import { parseSchedule } from "../iium/parser";

/** Three weeks of history: ~1 in 5 classes missed, the last two left unanswered, three tasks. */
export function seedState(now: Date): AppState {
  const today = ymd(now);
  let s = applySync({ ...emptyState(), onboarded: true }, parseSchedule(html), addDays(today, -21));
  const past = generateSessions(s, now).filter((x) => x.status === "unmarked");
  past.slice(0, -2).forEach((x, i) => {
    s = markSession(s, x.id, i % 5 === 3 ? "missed" : "attended");
  });
  const task = (title: string, courseId: string, days: number, done: boolean): Task => ({
    id: crypto.randomUUID(),
    title,
    courseId,
    due: atTime(addDays(today, days), "23:59").toISOString(),
    note: "",
    done,
  });
  const [a, b] = s.courses;
  return { ...s, tasks: [task("Lab report 2", a.id, -1, false), task("UX case study", b.id, 1, false), task("Quiz 1 prep", a.id, -5, true)] };
}
```

- [ ] **Step 6: Boot**

`src/boot.ts`:
```ts
import { App as CapApp } from "@capacitor/app";
import { markSession } from "./domain/actions";
import { courseStats } from "./domain/attendance";
import { warningFor } from "./domain/planner";
import { generateSessions } from "./domain/sessions";
import type { AppState } from "./domain/types";
import { initNotifications, isMark, notifyNow, reschedule } from "./notify/notify";
import { dispatch, getState, loadState, onStateChange } from "./store/store";
import { courseHref } from "./ui/router";

async function warnIfNeeded(prev: AppState, next: AppState): Promise<void> {
  const now = new Date();
  const before = generateSessions(prev, now);
  const after = generateSessions(next, now);
  for (const c of next.courses) {
    const msg = warningFor(c, courseStats(c, before).missed, courseStats(c, after).missed);
    if (msg) await notifyNow("Absence warning", msg, courseHref(c.id));
  }
}

export async function boot(): Promise<void> {
  await loadState();

  if (import.meta.env.DEV && new URLSearchParams(location.search).has("seed")) {
    const { seedState } = await import("./dev/seed");
    dispatch(() => seedState(new Date()));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const rescheduleSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void reschedule(getState()), 500);
  };

  onStateChange((prev, next) => {
    rescheduleSoon();
    if (prev.marks !== next.marks && next.settings.warningsEnabled) void warnIfNeeded(prev, next);
  });

  await initNotifications(({ actionId, sessionId, route }) => {
    if (sessionId && isMark(actionId)) dispatch((s) => markSession(s, sessionId, actionId));
    location.hash = route ?? "#/home";
  });

  rescheduleSoon();
  void CapApp.addListener("resume", rescheduleSoon);
}
```

`boot.ts` imports `courseHref` from `src/ui/router.ts`, which Task 9 creates. To keep this task compiling on its own, create it now with its final content (Task 9 adds its tests):

`src/ui/router.ts`:
```ts
import { useEffect, useState } from "preact/hooks";

export type Tab = "home" | "schedule" | "tasks" | "courses" | "settings";
export interface Route {
  tab: Tab;
  courseId?: string;
}

const TABS: Tab[] = ["home", "schedule", "tasks", "courses", "settings"];

export function parseHash(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, "").split("/");
  if (a === "course" && b) return { tab: "courses", courseId: decodeURIComponent(b) };
  return { tab: (TABS as string[]).includes(a) ? (a as Tab) : "home" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = path;
};

export const courseHref = (id: string) => `#/course/${encodeURIComponent(id)}`;
```

- [ ] **Step 7: Type-check**

Run: `mise x -- npx tsc && mise x -- npm test`
Expected: no type errors; all tests pass. (`src/main.tsx` is still the spike; that's fine.)

- [ ] **Step 8: Commit**

```bash
git add src && git commit -m "feat: store, notification adapter, IIUM sync, boot wiring"
```

---

### Task 9: UI foundation — theme, formatting, components, app shell

**Files:**
- Create: `src/ui/theme.css`, `src/ui/palette.ts`, `src/ui/format.ts`, `src/ui/useNow.ts`, `src/ui/components/icons.tsx`, `src/ui/components/TabBar.tsx`, `src/ui/components/Sheet.tsx`, `src/ui/components/Meter.tsx`, `src/ui/components/Toggle.tsx`, `src/ui/components/LinkCard.tsx`, `src/app.tsx`, placeholder screens `src/ui/screens/{Home,Schedule,Tasks,Courses,CourseDetail,Settings}.tsx`
- Modify: `src/main.tsx` (replace spike)
- Test: `src/ui/format.test.ts`, `src/ui/router.test.ts`

**Interfaces:**
- Consumes: store hooks, router (Task 8), `riskOf` (Task 4), time helpers.
- Produces:
  - format: `fmtTime("14:00") → "02:00 PM"`, `fmtDate("2026-10-05") → "Mon 5 Oct"`, `dayName(d: number): string`, `relDue(due: Date, now: Date): string`, `greeting(now: Date): string`, `minutesLeft(end: Date, now: Date): number`, `titleCase(s)`, `shortName(name)`, `initials(name: string | null | undefined)`
  - palette: `courseColor(i: number): { bg: string; fg: string }`
  - `useNow(intervalMs = 30000): Date`
  - icons: `IconHome, IconCalendar, IconTasks, IconCourses, IconSettings, IconPlus, IconChevron, IconBack, IconClock, IconPin, IconCheck` — each `(p: { size?: number }) => JSX.Element`
  - components: `<TabBar current: Tab />`, `<Sheet open onClose>children</Sheet>`, `<Meter missed limit />`, `riskLabel(missed, limit): string`, `<Toggle on onChange(v) />`, `<LinkCard />`

- [ ] **Step 1: Write failing format/router tests**

`src/ui/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fmtDate, fmtTime, greeting, initials, minutesLeft, relDue, shortName, titleCase } from "./format";

describe("format", () => {
  it.each([
    ["08:30", "08:30 AM"],
    ["12:50", "12:50 PM"],
    ["14:00", "02:00 PM"],
    ["00:15", "12:15 AM"],
  ])("fmtTime %s", (a, b) => expect(fmtTime(a)).toBe(b));

  it("fmtDate", () => expect(fmtDate("2026-10-05")).toBe("Mon 5 Oct"));

  it("relDue", () => {
    const now = new Date(2026, 9, 5, 12);
    expect(relDue(new Date(2026, 9, 5, 12, 30), now)).toBe("in 30m");
    expect(relDue(new Date(2026, 9, 5, 15), now)).toBe("in 3h");
    expect(relDue(new Date(2026, 9, 8, 12), now)).toBe("in 3d");
    expect(relDue(new Date(2026, 9, 4, 12), now)).toBe("overdue 1d");
  });

  it("greeting", () => {
    expect(greeting(new Date(2026, 9, 5, 9))).toBe("Good morning,");
    expect(greeting(new Date(2026, 9, 5, 13))).toBe("Good afternoon,");
    expect(greeting(new Date(2026, 9, 5, 20))).toBe("Good evening,");
  });

  it("names", () => {
    expect(titleCase("PRIVACY ENGINEERING")).toBe("Privacy Engineering");
    expect(shortName("ABDUL WAHID BIN EXAMPLE")).toBe("Abdul Wahid");
    expect(initials("ABDUL WAHID BIN EXAMPLE")).toBe("AW");
    expect(initials(null)).toBe("?");
  });

  it("minutesLeft", () => expect(minutesLeft(new Date(2026, 9, 5, 12, 50), new Date(2026, 9, 5, 12, 42))).toBe(8));
});
```

`src/ui/router.test.ts`:
```ts
import { expect, it } from "vitest";
import { courseHref, parseHash } from "./router";

it("parses hashes", () => {
  expect(parseHash("")).toEqual({ tab: "home" });
  expect(parseHash("#/tasks")).toEqual({ tab: "tasks" });
  expect(parseHash("#/nope")).toEqual({ tab: "home" });
  expect(parseHash(courseHref("BICS 4350-1"))).toEqual({ tab: "courses", courseId: "BICS 4350-1" });
});
```

Run: `mise x -- npm test -- src/ui`
Expected: format tests FAIL (no module); router test PASS.

- [ ] **Step 2: Implement format, palette, useNow**

`src/ui/format.ts`:
```ts
import { parseYmd } from "../domain/time";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dayName = (d: number) => DAYS[d];

export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtDate(ymdStr: string): string {
  const d = parseYmd(ymdStr);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function relDue(due: Date, now: Date): string {
  const mins = Math.round((due.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(mins);
  const span = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins < 0 ? `overdue ${span}` : `in ${span}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}

export const minutesLeft = (end: Date, now: Date) => Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 60_000));

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const firstTwo = (name: string) => name.trim().split(/\s+/).slice(0, 2);

export const shortName = (name: string) => titleCase(firstTwo(name).join(" "));

export const initials = (name: string | null | undefined) =>
  name ? firstTwo(name).map((w) => w[0].toUpperCase()).join("") : "?";
```

`src/ui/palette.ts`:
```ts
const PALETTE = [
  { bg: "#421A00", fg: "#FFA65C" },
  { bg: "#3A0763", fg: "#D9A8FF" },
  { bg: "#192E03", fg: "#C6F25A" },
  { bg: "#1D1B4A", fg: "#A9B1FF" },
  { bg: "#083343", fg: "#67E0F5" },
  { bg: "#3D2600", fg: "#FFD84D" },
  { bg: "#3F0A1E", fg: "#FF8FB5" },
  { bg: "#1A2733", fg: "#9CC3E6" },
];

export const courseColor = (i: number) => PALETTE[i % PALETTE.length];
```

`src/ui/useNow.ts`:
```ts
import { useEffect, useState } from "preact/hooks";

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
```

Run: `mise x -- npm test -- src/ui`
Expected: PASS.

- [ ] **Step 3: Theme**

Run: `mise x -- npm i @fontsource/libre-baskerville @fontsource/manrope`

`src/ui/theme.css`:
```css
:root {
  --bg: #0b0c0e;
  --surface: #131416;
  --border: #1e1f21;
  --accent: #48de7c;
  --accent-dim: #15331f;
  --hero: #0c1b14;
  --hero-line: #1f4a33;
  --text: #f2f2f2;
  --text-muted: #7c7d7f;
  --danger: #e9777c;
  --danger-bg: #3a1416;
  --missed: #6b2e30;
  --warn: #f5b53d;
  --on-accent: #06210f;
  --serif: "Libre Baskerville", Georgia, serif;
  --sans: "Manrope", system-ui, sans-serif;
  --gutter: 20px;
  --tabbar-h: 68px;
  color-scheme: dark;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 15px; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
button:active { transform: scale(0.98); }
button:disabled { opacity: 0.4; }
a { color: inherit; text-decoration: none; }
input, select, textarea { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; width: 100%; }
svg { vertical-align: -2px; }

.screen { max-width: 560px; margin: 0 auto; padding: max(env(safe-area-inset-top), 12px) var(--gutter) calc(var(--tabbar-h) + 24px + env(safe-area-inset-bottom)); }
.page-title { font-family: var(--serif); color: var(--accent); text-align: center; font-size: 26px; margin: 28px 0 24px; }
.section-title { font-family: var(--serif); color: var(--accent); font-size: 22px; margin: 28px 0 12px; display: flex; align-items: center; gap: 10px; }
.section-title.muted { color: var(--text-muted); }
.count { font-family: var(--sans); font-size: 13px; background: var(--accent-dim); color: var(--accent); border-radius: 8px; padding: 2px 9px; }
.section-title.muted .count { background: var(--surface); color: var(--text-muted); }
.link { color: var(--accent); font-family: var(--sans); font-size: 14px; font-weight: 700; margin-left: auto; }

.greeting p { color: var(--text-muted); font-family: var(--serif); font-size: 20px; margin: 24px 0 0; }
.greeting h1 { font-family: var(--serif); font-size: 30px; margin: 4px 0 16px; }

.card { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; margin-bottom: 12px; }
.card.muted { color: var(--text-muted); text-align: center; }
.card.glow-warn { border-color: var(--warn); box-shadow: 0 0 14px rgba(245, 181, 61, 0.25); }
.card.glow-danger { border-color: var(--danger); box-shadow: 0 0 14px rgba(233, 119, 124, 0.25); }
.course-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; }
.course-name { margin: 10px 0 0; font-weight: 600; }

.hero { background: var(--hero); border: 1px solid var(--hero-line); border-radius: 22px; padding: 12px; box-shadow: 0 0 24px rgba(72, 222, 124, 0.08); }
.hero-class { border: 1px solid var(--hero-line); border-radius: 16px; padding: 14px 16px; }
.hero-top { display: flex; align-items: center; gap: 12px; }
.chip { display: inline-block; background: var(--accent-dim); color: var(--accent); font-weight: 700; font-size: 13px; padding: 5px 12px; border-radius: 999px; }
.progress { flex: 1; height: 6px; border-radius: 999px; background: #1f2a24; overflow: hidden; }
.progress > span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.hero-left { color: var(--accent); font-weight: 700; font-size: 13px; white-space: nowrap; margin-left: auto; }
.hero-time { color: var(--accent); font-size: 13px; margin: 18px 0 2px; }
.hero-name { color: var(--accent); font-weight: 700; font-size: 20px; margin: 0; }
.hero-venue { color: #5fb47f; font-size: 13px; margin: 2px 0 0; }
.pill { display: inline-block; font-weight: 700; font-size: 12px; letter-spacing: 0.04em; padding: 5px 12px; border-radius: 999px; margin: 10px 0; }
.pill.danger { color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger); }
.next-row { display: flex; justify-content: space-between; gap: 12px; border: 1px solid var(--hero-line); border-radius: 16px; padding: 12px 16px; }
.next-row b { color: var(--accent); display: block; }
.next-row small { display: block; color: var(--text-muted); }
.next-row .right { text-align: right; font-size: 13px; }
.next-row .right b { color: var(--text); }

.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px; margin-bottom: 10px; }
.row small { display: block; color: var(--text-muted); font-size: 13px; margin-top: 2px; }
.row .grow { flex: 1; min-width: 0; }
.btn { border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 13px; border: 1px solid var(--border); flex: none; }
.btn.ok { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.btn.bad { color: var(--danger); border-color: var(--danger); }
.btn.primary { display: block; width: 100%; background: var(--accent); color: var(--on-accent); border-color: var(--accent); padding: 14px; font-size: 15px; border-radius: 14px; margin-top: 8px; }
.btn.ghost { display: block; width: 100%; padding: 14px; color: var(--text-muted); border: 0; }

.meter { display: flex; gap: 4px; margin-top: 10px; }
.meter span { flex: 1; height: 6px; border-radius: 999px; background: var(--accent-dim); }
.meter span.on { background: var(--accent); }
.meter.risk-warn span.on { background: var(--warn); }
.meter.risk-danger span.on, .meter.risk-barred span.on { background: var(--danger); }
.risk-text-ok { color: var(--text-muted); }
.risk-text-warn { color: var(--warn); }
.risk-text-danger, .risk-text-barred { color: var(--danger); }

.tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; display: flex; background: var(--bg); border-top: 1px solid var(--border); padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); }
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); }
.tab svg { width: 24px; height: 24px; }
.tab.active { color: var(--accent); font-weight: 700; }
.tab.active svg { fill: var(--accent-dim); }

.sheet-backdrop { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; background: rgba(0, 0, 0, 0.6); animation: fade 0.15s; }
.sheet { width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; margin: 0 auto; background: var(--surface); border: 1px solid var(--border); border-radius: 22px 22px 0 0; padding: 10px var(--gutter) calc(24px + env(safe-area-inset-bottom)); animation: up 0.2s ease-out; }
.sheet-handle { width: 40px; height: 4px; border-radius: 999px; background: var(--border); margin: 0 auto 16px; }
.sheet h2 { font-family: var(--serif); color: var(--accent); margin: 0 0 16px; font-size: 20px; }
.field { display: block; margin-bottom: 14px; }
.field span { display: block; color: var(--text-muted); font-size: 13px; margin-bottom: 6px; }
.field-row { display: flex; gap: 10px; }
.field-row .field { flex: 1; }
@keyframes up { from { transform: translateY(100%); } }
@keyframes fade { from { opacity: 0; } }

.fab { position: fixed; right: var(--gutter); bottom: calc(var(--tabbar-h) + 20px + env(safe-area-inset-bottom)); z-index: 5; width: 56px; height: 56px; border-radius: 18px; background: var(--accent); color: var(--on-accent); display: grid; place-items: center; box-shadow: 0 6px 20px rgba(72, 222, 124, 0.3); }
.check { width: 24px; height: 24px; flex: none; border-radius: 50%; border: 2px solid var(--text-muted); display: grid; place-items: center; }
.check.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.task-done .grow b { text-decoration: line-through; color: var(--text-muted); }
.overdue small { color: var(--danger); }

.sched { --label-w: 52px; --col: calc((100% - var(--label-w)) / var(--cols)); }
.sched-head { display: grid; grid-template-columns: repeat(var(--cols), 1fr) var(--label-w); gap: 6px; margin-bottom: 12px; }
.day-pill { text-align: center; padding: 9px 0; border-radius: 10px; border: 1px solid var(--accent-dim); color: var(--accent); font-weight: 600; }
.day-pill.active { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.sched-body { position: relative; }
.hour-line { position: absolute; left: 0; right: 0; border-top: 1px dashed #1a1b1d; }
.hour-line span { position: absolute; right: 0; top: -9px; font-size: 12px; color: var(--text-muted); background: var(--bg); padding-left: 4px; }
.block { position: absolute; width: calc(var(--col) - 6px); border-radius: 14px; padding: 8px 6px; overflow: hidden; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.block .t1 { position: absolute; top: 6px; left: 8px; font-size: 11px; opacity: 0.7; }
.block .t2 { position: absolute; bottom: 6px; right: 8px; font-size: 11px; opacity: 0.7; }
.block b { font-size: 17px; line-height: 1.1; }
.block small { font-size: 10px; text-transform: uppercase; opacity: 0.85; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.now-line { position: absolute; left: 0; right: 0; z-index: 2; pointer-events: none; border-top: 1.5px dashed var(--text); }
.now-line span { position: absolute; right: 0; top: -10px; font-size: 12px; font-weight: 700; background: var(--bg); padding-left: 4px; }

.back { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); margin: 20px 0 16px; }
.detail-title { font-family: var(--serif); font-size: 24px; margin: 10px 0 18px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 14px 8px; text-align: center; }
.stat b { display: block; font-size: 26px; color: var(--accent); }
.stat span { font-size: 12px; color: var(--text-muted); }
.stat.risk-warn b { color: var(--warn); }
.stat.risk-danger b, .stat.risk-barred b { color: var(--danger); }
.grid-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px; }
.sgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(26px, 1fr)); gap: 6px; }
.sq { aspect-ratio: 1; border-radius: 6px; background: var(--accent-dim); }
.sq-attended { background: var(--accent); }
.sq-missed { background: var(--missed); }
.grid-caption { color: var(--text-muted); font-size: 13px; margin: 12px 0 0; }
.seg { display: flex; flex: none; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
.seg button { padding: 7px 12px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.seg button.on.ok { background: var(--accent); color: var(--on-accent); }
.seg button.on.bad { background: var(--missed); color: var(--text); }

.profile { display: flex; gap: 14px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 22px; padding: 16px; }
.avatar { width: 64px; height: 64px; flex: none; border-radius: 50%; background: var(--accent-dim); color: var(--accent); display: grid; place-items: center; font-family: var(--serif); font-size: 24px; }
.profile b { color: var(--accent); font-size: 17px; }
.profile small { display: block; color: var(--text-muted); }
.group-title { font-weight: 700; margin: 26px 0 10px; }
.group-hint { color: var(--text-muted); font-size: 13px; margin: -4px 0 10px; }
.toggle { position: relative; width: 46px; height: 28px; flex: none; border-radius: 999px; background: var(--border); }
.toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: var(--text-muted); transition: transform 0.15s; }
.toggle[aria-checked="true"] { background: var(--accent-dim); }
.toggle[aria-checked="true"]::after { transform: translateX(18px); background: var(--accent); }
.status-ok { color: var(--accent); font-size: 13px; font-weight: 700; }
.status-bad { color: var(--warn); font-size: 13px; font-weight: 700; }
.error { color: var(--danger); font-size: 14px; margin: 8px 0; }

.skeleton { height: 80px; border-radius: 16px; margin: 12px 0; background: linear-gradient(90deg, var(--surface), #1a1b1d, var(--surface)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }

.onboard { min-height: 100vh; max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 24px var(--gutter); }
.onboard h1 { font-family: var(--serif); color: var(--accent); font-size: 32px; margin: 0; }
.onboard p { color: var(--text-muted); line-height: 1.5; margin: 0 0 4px; }
.logo { width: 56px; height: 56px; border-radius: 16px; background: var(--accent); color: var(--on-accent); display: grid; place-items: center; }
```

- [ ] **Step 4: Icons and components**

`src/ui/components/icons.tsx`:
```tsx
import type { ComponentChildren } from "preact";

type P = { size?: number };

const Svg = ({ size = 24, children }: P & { children: ComponentChildren }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    {children}
  </svg>
);

export const IconHome = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const IconCalendar = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const IconTasks = (p: P) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></Svg>;
export const IconCourses = (p: P) => <Svg {...p}><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20" /></Svg>;
export const IconSettings = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
```

`src/ui/components/TabBar.tsx`:
```tsx
import type { Tab } from "../router";
import { IconCalendar, IconCourses, IconHome, IconSettings, IconTasks } from "./icons";

const ITEMS = [
  { tab: "home", label: "Home", Icon: IconHome },
  { tab: "schedule", label: "Schedule", Icon: IconCalendar },
  { tab: "tasks", label: "Tasks", Icon: IconTasks },
  { tab: "courses", label: "Courses", Icon: IconCourses },
  { tab: "settings", label: "Settings", Icon: IconSettings },
] as const;

export function TabBar({ current }: { current: Tab }) {
  return (
    <nav class="tabbar">
      {ITEMS.map(({ tab, label, Icon }) => (
        <a key={tab} href={`#/${tab}`} class={`tab ${current === tab ? "active" : ""}`}>
          <Icon />
          {label}
        </a>
      ))}
    </nav>
  );
}
```

`src/ui/components/Sheet.tsx`:
```tsx
import type { ComponentChildren } from "preact";

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ComponentChildren }) {
  if (!open) return null;
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-handle" />
        {children}
      </div>
    </div>
  );
}
```

`src/ui/components/Meter.tsx`:
```tsx
import { riskOf } from "../../domain/attendance";

export const riskLabel = (missed: number, limit: number) => (missed >= limit ? "Barred" : `${missed} / ${limit} missed`);

export function Meter({ missed, limit }: { missed: number; limit: number }) {
  return (
    <div class={`meter risk-${riskOf(missed, limit)}`}>
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} class={i < missed ? "on" : ""} />
      ))}
    </div>
  );
}
```

`src/ui/components/Toggle.tsx`:
```tsx
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button class="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)} />;
}
```

`src/ui/components/LinkCard.tsx`:
```tsx
import { go } from "../router";

export function LinkCard() {
  return (
    <div class="card muted">
      <p>Link your IIUM account to load your timetable.</p>
      <button class="btn primary" onClick={() => go("#/settings")}>Go to Settings</button>
    </div>
  );
}
```

- [ ] **Step 5: Placeholder screens**

Create each of these with a single heading (later tasks replace them):

`src/ui/screens/Home.tsx`:
```tsx
export function Home() {
  return <h1 class="page-title">Home</h1>;
}
```
`src/ui/screens/Schedule.tsx` → `export function Schedule() { return <h1 class="page-title">Schedule</h1>; }`
`src/ui/screens/Tasks.tsx` → `export function Tasks() { return <h1 class="page-title">Tasks</h1>; }`
`src/ui/screens/Courses.tsx` → `export function Courses() { return <h1 class="page-title">Courses</h1>; }`
`src/ui/screens/CourseDetail.tsx` → `export function CourseDetail({ id }: { id: string }) { return <h1 class="page-title">{id}</h1>; }`
`src/ui/screens/Settings.tsx` → `export function Settings() { return <h1 class="page-title">Settings</h1>; }`

- [ ] **Step 6: App shell and entry**

`src/app.tsx`:
```tsx
import type { JSX } from "preact";
import { shareFile } from "./native/share";
import { useAppState, useLoadStatus } from "./store/store";
import { TabBar } from "./ui/components/TabBar";
import { useRoute } from "./ui/router";
import type { Tab } from "./ui/router";
import { CourseDetail } from "./ui/screens/CourseDetail";
import { Courses } from "./ui/screens/Courses";
import { Home } from "./ui/screens/Home";
import { Schedule } from "./ui/screens/Schedule";
import { Settings } from "./ui/screens/Settings";
import { Tasks } from "./ui/screens/Tasks";

const SCREENS: Record<Tab, () => JSX.Element> = { home: Home, schedule: Schedule, tasks: Tasks, courses: Courses, settings: Settings };

function LoadError({ message, raw }: { message: string; raw: string }) {
  return (
    <div class="onboard">
      <h1>Couldn't load your data</h1>
      <p>{message}. Nothing has been changed or deleted. Export the saved data to keep a copy.</p>
      <button class="btn primary" onClick={() => void shareFile("hadir-raw.json", raw)}>Export saved data</button>
    </div>
  );
}

export function App() {
  const status = useLoadStatus();
  useAppState();
  const route = useRoute();

  if (!status.loaded) return <div class="screen"><div class="skeleton" /><div class="skeleton" /></div>;
  if (status.error) return <LoadError message={status.error} raw={status.raw ?? ""} />;

  const Screen = SCREENS[route.tab];
  return (
    <>
      <main class="screen">{route.courseId ? <CourseDetail id={route.courseId} /> : <Screen />}</main>
      <TabBar current={route.tab} />
    </>
  );
}
```

Replace `src/main.tsx`:
```tsx
import "@fontsource/libre-baskerville/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./ui/theme.css";
import { render } from "preact";
import { App } from "./app";
import { boot } from "./boot";

render(<App />, document.getElementById("app")!);
void boot();
```

- [ ] **Step 7: Verify**

Run: `mise x -- npx tsc && mise x -- npm test`
Expected: clean.

Run `mise x -- npm run dev`, open `http://localhost:5173/?seed` at 412×915 (phone viewport). Expected: dark background, bottom tab bar with 5 tabs; tapping each tab changes the green heading and highlights the tab; fonts render as serif heading / sans labels.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: UI foundation — Aurum-style theme, tab bar, shared components"
```

---

### Task 10: Home screen

**Files:**
- Create: `src/ui/components/TaskRow.tsx`
- Modify: `src/ui/screens/Home.tsx`

**Interfaces:**
- Consumes: `generateSessions`, `courseStats`, `markSession`, `toggleTask`, store, format, router, components.
- Produces: `<TaskRow task course? now onOpen />` (used by Tasks and Course detail).

- [ ] **Step 1: TaskRow**

`src/ui/components/TaskRow.tsx`:
```tsx
import { toggleTask } from "../../domain/actions";
import { ymd } from "../../domain/time";
import type { Course, Task } from "../../domain/types";
import { dispatch } from "../../store/store";
import { fmtDate, relDue } from "../format";
import { IconCheck } from "./icons";

export function TaskRow({ task, course, now, onOpen }: { task: Task; course?: Course; now: Date; onOpen: () => void }) {
  const due = new Date(task.due);
  const overdue = !task.done && due < now;
  return (
    <div class={`row ${task.done ? "task-done" : ""} ${overdue ? "overdue" : ""}`} onClick={onOpen}>
      <button
        class={`check ${task.done ? "on" : ""}`}
        aria-label={task.done ? "Mark not done" : "Mark done"}
        onClick={(e) => {
          e.stopPropagation();
          dispatch((s) => toggleTask(s, task.id));
        }}
      >
        {task.done && <IconCheck size={14} />}
      </button>
      <div class="grow">
        <b>{task.title}</b>
        <small>{[course?.code, task.done ? fmtDate(ymd(due)) : relDue(due, now)].filter(Boolean).join(" · ")}</small>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Home**

`src/ui/screens/Home.tsx`:
```tsx
import { useMemo } from "preact/hooks";
import { markSession } from "../../domain/actions";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { hhmm } from "../../domain/time";
import type { Course, Session, Slot } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { dayName, fmtDate, fmtTime, greeting, minutesLeft, relDue, shortName, titleCase } from "../format";
import { courseHref, go } from "../router";
import { useNow } from "../useNow";
import { IconClock, IconPin } from "../components/icons";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";
import { TaskRow } from "../components/TaskRow";

type Info = (s: Session) => { course: Course; slot: Slot };

function NowCard({ current, next, info, now }: { current?: Session; next?: Session; info: Info; now: Date }) {
  const main = current ?? next;
  if (!main) return <div class="card muted">No more classes this semester</div>;
  const { course, slot } = info(main);
  const pct = current ? Math.min(100, ((now.getTime() - main.start.getTime()) / (main.end.getTime() - main.start.getTime())) * 100) : 0;
  const after = current ? next : undefined;
  const n = after && info(after);
  return (
    <div class="hero">
      <div class="hero-class">
        <div class="hero-top">
          <span class="chip">{course.code}</span>
          {current && <div class="progress"><span style={`width:${pct}%`} /></div>}
          <span class="hero-left">{current ? `${minutesLeft(main.end, now)} min left` : `starts ${relDue(main.start, now)}`}</span>
        </div>
        <p class="hero-time"><IconClock size={14} /> {fmtTime(slot.start)} - {fmtTime(slot.end)} · {dayName(main.start.getDay())}</p>
        <p class="hero-name">{titleCase(course.name)}</p>
        <p class="hero-venue"><IconPin size={14} /> {slot.venue}</p>
      </div>
      {after && n && (
        <>
          <span class="pill danger">UPCOMING</span>
          <div class="next-row">
            <div><b>{n.course.code}</b><small>{titleCase(n.course.name)}</small></div>
            <div class="right"><small>{dayName(after.start.getDay())}</small><b>{fmtTime(n.slot.start)} - {fmtTime(n.slot.end)}</b><small>{n.slot.venue}</small></div>
          </div>
        </>
      )}
    </div>
  );
}

export function Home() {
  const state = useAppState();
  const now = useNow();
  const sessions = useMemo(() => generateSessions(state, now), [state, now]);
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const slots = new Map(state.slots.map((s) => [s.id, s]));
  const info: Info = (s) => ({ course: courses.get(s.courseId)!, slot: slots.get(s.slotId)! });

  const current = sessions.find((s) => s.start <= now && now < s.end);
  const next = sessions.find((s) => s.start > now);
  const unmarked = sessions.filter((s) => s.status === "unmarked").reverse();
  const warnings = state.courses
    .filter((c) => c.active)
    .map((c) => ({ c, st: courseStats(c, sessions) }))
    .filter((x) => x.st.risk !== "ok")
    .sort((a, b) => b.st.missed - a.st.missed);
  const due = state.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);

  return (
    <>
      <header class="greeting">
        <p>{greeting(now)}</p>
        <h1>{state.account?.name ? shortName(state.account.name) : "Student"}</h1>
      </header>

      {state.courses.length === 0 ? <LinkCard /> : <NowCard current={current} next={next} info={info} now={now} />}

      {unmarked.length > 0 && (
        <>
          <h2 class="section-title">Unmarked <span class="count">{unmarked.length}</span></h2>
          {unmarked.map((s) => (
            <div class="row" key={s.id}>
              <div class="grow"><b>{info(s).course.code}</b><small>{fmtDate(s.date)} · {fmtTime(hhmm(s.start))}</small></div>
              <button class="btn ok" onClick={() => dispatch((st) => markSession(st, s.id, "attended"))}>Attended</button>
              <button class="btn bad" onClick={() => dispatch((st) => markSession(st, s.id, "missed"))}>Missed</button>
            </div>
          ))}
        </>
      )}

      {warnings.length > 0 && (
        <>
          <h2 class="section-title">Watch out</h2>
          {warnings.map(({ c, st }) => (
            <a key={c.id} class={`card glow-${st.risk === "warn" ? "warn" : "danger"}`} href={courseHref(c.id)}>
              <div class="course-head"><span class="chip">{c.code}</span><span class={`risk-text-${st.risk}`}>{riskLabel(st.missed, st.limit)}</span></div>
              <Meter missed={st.missed} limit={st.limit} />
            </a>
          ))}
        </>
      )}

      {due.length > 0 && (
        <>
          <h2 class="section-title">Due soon</h2>
          {due.map((t) => (
            <TaskRow key={t.id} task={t} course={t.courseId ? courses.get(t.courseId) : undefined} now={now} onOpen={() => go("#/tasks")} />
          ))}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `mise x -- npx tsc`
Expected: clean.

In the browser at `http://localhost:5173/?seed` (412×915), check:
- Greeting shows "Abdul Wahid"; now/next hero card in green with course chip; progress bar only while a class is in progress.
- "Unmarked 2" list; tapping **Missed** removes the row and (if it pushes a course to 4+) a "Watch out" card appears with an amber/red meter.
- "Due soon": overdue task in red text; tapping the circle marks it done and it disappears; tapping the row goes to the Tasks tab.
- Reload `http://localhost:5173/` (no `?seed`): data persists (Preferences web fallback).
- Clear site data and reload: Home shows the "Link your IIUM account" card whose button lands on Settings (no dead end).

- [ ] **Step 4: Commit**

```bash
git add src/ui && git commit -m "feat: home screen with now/next card, unmarked list, warnings, due soon"
```

---

### Task 11: Schedule screen

**Files:**
- Modify: `src/ui/screens/Schedule.tsx`

**Interfaces:**
- Consumes: store, `generateSessions`, `courseStats`, `courseColor`, format, router, `Sheet`, `Meter`, `LinkCard`.

- [ ] **Step 1: Implement**

`src/ui/screens/Schedule.tsx`:
```tsx
import { useState } from "preact/hooks";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { hhmm } from "../../domain/time";
import type { Slot } from "../../domain/types";
import { useAppState } from "../../store/store";
import { dayName, fmtTime, titleCase } from "../format";
import { courseColor } from "../palette";
import { courseHref, go } from "../router";
import { useNow } from "../useNow";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";
import { Sheet } from "../components/Sheet";

const PX_PER_MIN = 1.5;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const mondayFirst = (d: number) => (d + 6) % 7;

export function Schedule() {
  const state = useAppState();
  const now = useNow();
  const [open, setOpen] = useState<Slot | null>(null);

  const courses = new Map(state.courses.filter((c) => c.active).map((c) => [c.id, c]));
  const slots = state.slots.filter((s) => courses.has(s.courseId));
  const title = <h1 class="page-title">{state.semester?.label ?? "Schedule"}</h1>;
  if (!slots.length) return <>{title}<LinkCard /></>;

  const days = [...new Set(slots.map((s) => s.day))].sort((a, b) => mondayFirst(a) - mondayFirst(b));
  const startMin = Math.floor(Math.min(...slots.map((s) => toMin(s.start))) / 60) * 60;
  const endMin = Math.ceil(Math.max(...slots.map((s) => toMin(s.end))) / 60) * 60;
  const y = (min: number) => (min - startMin) * PX_PER_MIN;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lines: number[] = [];
  for (let m = startMin; m <= endMin; m += 30) lines.push(m);
  const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const openCourse = open ? courses.get(open.courseId) : undefined;
  const openStats = openCourse ? courseStats(openCourse, generateSessions(state, now)) : undefined;

  return (
    <>
      {title}
      <div class="sched" style={`--cols:${days.length}`}>
        <div class="sched-head">
          {days.map((d) => <span key={d} class={`day-pill ${d === now.getDay() ? "active" : ""}`}>{dayName(d)}</span>)}
          <span />
        </div>
        <div class="sched-body" style={`height:${y(endMin) + 12}px`}>
          {lines.map((m) => <div key={m} class="hour-line" style={`top:${y(m)}px`}><span>{label(m)}</span></div>)}
          {days.map((d, i) =>
            slots.filter((s) => s.day === d).map((s) => {
              const c = courses.get(s.courseId)!;
              const color = courseColor(c.color);
              return (
                <button
                  key={s.id}
                  class="block"
                  style={`left:calc(var(--col) * ${i});top:${y(toMin(s.start)) + 3}px;height:${(toMin(s.end) - toMin(s.start)) * PX_PER_MIN - 6}px;background:${color.bg};color:${color.fg}`}
                  onClick={() => setOpen(s)}
                >
                  <span class="t1">{s.start}</span>
                  <b>{c.code}</b>
                  <small>{titleCase(c.name)}</small>
                  <span class="t2">{s.end}</span>
                </button>
              );
            }),
          )}
          {nowMin >= startMin && nowMin <= endMin && (
            <div class="now-line" style={`top:${y(nowMin)}px`}><span>{hhmm(now)}</span></div>
          )}
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && openCourse && openStats && (
          <>
            <h2>{titleCase(openCourse.name)}</h2>
            <p class="group-hint">{openCourse.code} · Section {openCourse.section}</p>
            <div class="row"><div class="grow"><b>{dayName(open.day)} {fmtTime(open.start)} – {fmtTime(open.end)}</b><small>{open.venue}</small></div></div>
            <div class="row"><div class="grow"><b>Lecturer</b><small>{open.lecturer || "—"}</small></div></div>
            <div class="card">
              <div class="course-head"><span>Absences</span><span class={`risk-text-${openStats.risk}`}>{riskLabel(openStats.missed, openStats.limit)}</span></div>
              <Meter missed={openStats.missed} limit={openStats.limit} />
            </div>
            <button class="btn primary" onClick={() => { setOpen(null); go(courseHref(openCourse.id)); }}>Open course</button>
          </>
        )}
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `mise x -- npx tsc`
Expected: clean.

In the browser (`?seed`, 412×915): day pills Mon–Thu, today's filled green; colored blocks in the right columns/times matching the fixture (BICS 4350 Mon/Wed 11:30–12:50; BICS 2304 Tue/Thu 14:00–15:20); dashed now-line with time label when within hours; tapping a block opens the sheet; **Open course** goes to the course page (placeholder for now); tapping the backdrop closes the sheet. Compare side-by-side with `references/calendar-view.jpeg`.

- [ ] **Step 3: Commit**

```bash
git add src/ui && git commit -m "feat: Aurum-style schedule grid with class detail sheet"
```

---

### Task 12: Tasks screen and task sheet

**Files:**
- Create: `src/ui/components/TaskSheet.tsx`
- Modify: `src/ui/screens/Tasks.tsx`

**Interfaces:**
- Consumes: `upsertTask`, `deleteTask`, `atTime`, `addDays`, `hhmm`, `ymd`, `TaskRow`, `Sheet`.
- Produces: `<TaskSheet open task: Task | null presetCourseId?: string | null onClose />` (used by Course detail).

- [ ] **Step 1: TaskSheet**

`src/ui/components/TaskSheet.tsx`:
```tsx
import { useEffect, useState } from "preact/hooks";
import { deleteTask, upsertTask } from "../../domain/actions";
import { addDays, atTime, hhmm, ymd } from "../../domain/time";
import type { Task } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { Sheet } from "./Sheet";

interface Props {
  open: boolean;
  task: Task | null;
  presetCourseId?: string | null;
  onClose: () => void;
}

export function TaskSheet({ open, task, presetCourseId = null, onClose }: Props) {
  const state = useAppState();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const due = task ? new Date(task.due) : null;
    setTitle(task?.title ?? "");
    setCourseId(task ? task.courseId : presetCourseId);
    setDate(due ? ymd(due) : addDays(ymd(new Date()), 1));
    setTime(due ? hhmm(due) : "23:59");
    setNote(task?.note ?? "");
  }, [open, task, presetCourseId]);

  function save() {
    const next: Task = {
      id: task?.id ?? crypto.randomUUID(),
      title: title.trim(),
      courseId,
      due: atTime(date, time).toISOString(),
      note: note.trim(),
      done: task?.done ?? false,
    };
    dispatch((s) => upsertTask(s, next));
    onClose();
  }

  function remove() {
    if (task) dispatch((s) => deleteTask(s, task.id));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{task ? "Edit task" : "New task"}</h2>
      <label class="field"><span>Title</span><input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Lab report 2" /></label>
      <label class="field">
        <span>Course</span>
        <select value={courseId ?? ""} onChange={(e) => setCourseId(e.currentTarget.value || null)}>
          <option value="">No course</option>
          {state.courses.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
      </label>
      <div class="field-row">
        <label class="field"><span>Due date</span><input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} /></label>
        <label class="field"><span>Time</span><input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></label>
      </div>
      <label class="field"><span>Note</span><textarea rows={3} value={note} onInput={(e) => setNote(e.currentTarget.value)} /></label>
      <button class="btn primary" disabled={!title.trim() || !date || !time} onClick={save}>Save</button>
      {task && <button class="btn ghost" onClick={remove}>Delete task</button>}
    </Sheet>
  );
}
```

- [ ] **Step 2: Tasks screen**

`src/ui/screens/Tasks.tsx`:
```tsx
import { useState } from "preact/hooks";
import type { Task } from "../../domain/types";
import { useAppState } from "../../store/store";
import { useNow } from "../useNow";
import { IconPlus } from "../components/icons";
import { TaskRow } from "../components/TaskRow";
import { TaskSheet } from "../components/TaskSheet";

export function Tasks() {
  const state = useAppState();
  const now = useNow();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const upcoming = state.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const past = state.tasks.filter((t) => t.done).sort((a, b) => b.due.localeCompare(a.due));
  const edit = (t: Task | null) => {
    setEditing(t);
    setOpen(true);
  };
  const row = (t: Task) => (
    <TaskRow key={t.id} task={t} course={t.courseId ? courses.get(t.courseId) : undefined} now={now} onOpen={() => edit(t)} />
  );

  return (
    <>
      <h1 class="page-title">Tasks</h1>
      <h2 class="section-title">Upcoming <span class="count">{upcoming.length}</span></h2>
      {upcoming.length ? upcoming.map(row) : <div class="card muted">Nothing due. Tap + to add a task.</div>}
      <h2 class="section-title muted">Past <span class="count">{past.length}</span></h2>
      {past.map(row)}
      <button class="fab" aria-label="Add task" onClick={() => edit(null)}><IconPlus size={28} /></button>
      <TaskSheet open={open} task={editing} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `mise x -- npx tsc`
Expected: clean.

In the browser (`?seed`): Upcoming lists 2 tasks with the overdue one first in red; Past lists the done one struck through. **+** opens the sheet with tomorrow 23:59 preset; Save is disabled until a title is typed; saving adds the row; tapping a row opens it for edit with values filled; **Delete task** removes it; checking a row moves it to Past and back.

- [ ] **Step 4: Commit**

```bash
git add src/ui && git commit -m "feat: tasks screen with add/edit bottom sheet"
```

---

### Task 13: Courses screen, course detail, session grid

**Files:**
- Create: `src/ui/components/SessionGrid.tsx`
- Modify: `src/ui/screens/Courses.tsx`, `src/ui/screens/CourseDetail.tsx`

**Interfaces:**
- Consumes: `generateSessions`, `courseStats`, `markSession`, `TaskRow`, `TaskSheet`, `Meter`, format, router.
- Produces: `<SessionGrid sessions: Session[] />`.

- [ ] **Step 1: Session grid**

`src/ui/components/SessionGrid.tsx`:
```tsx
import { useState } from "preact/hooks";
import { hhmm } from "../../domain/time";
import type { Session, SessionStatus } from "../../domain/types";
import { fmtDate, fmtTime } from "../format";

const LABEL: Record<SessionStatus, string> = { upcoming: "Upcoming", unmarked: "Not answered", attended: "Attended", missed: "Missed" };

export function SessionGrid({ sessions }: { sessions: Session[] }) {
  const [selected, setSelected] = useState<Session | null>(null);
  return (
    <div class="grid-card">
      <div class="sgrid">
        {sessions.map((s) => (
          <button key={s.id} class={`sq sq-${s.status}`} aria-label={`${fmtDate(s.date)} ${LABEL[s.status]}`} onClick={() => setSelected(s)} />
        ))}
      </div>
      <p class="grid-caption">
        {selected
          ? `${fmtDate(selected.date)} · ${fmtTime(hhmm(selected.start))} · ${LABEL[selected.status]}`
          : `${sessions.length} classes this semester`}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Courses list**

`src/ui/screens/Courses.tsx`:
```tsx
import { useMemo } from "preact/hooks";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { useAppState } from "../../store/store";
import { titleCase } from "../format";
import { courseHref } from "../router";
import { useNow } from "../useNow";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";

export function Courses() {
  const state = useAppState();
  const now = useNow();
  const sessions = useMemo(() => generateSessions(state, now), [state, now]);
  const list = state.courses
    .filter((c) => c.active)
    .map((c) => ({ c, st: courseStats(c, sessions) }))
    .sort((a, b) => b.st.missed - a.st.missed || a.c.code.localeCompare(b.c.code));

  return (
    <>
      <h1 class="page-title">Courses</h1>
      {list.length === 0 && <LinkCard />}
      {list.map(({ c, st }) => (
        <a key={c.id} class="card" href={courseHref(c.id)}>
          <div class="course-head"><span class="chip">{c.code}</span><span class={`risk-text-${st.risk}`}>{riskLabel(st.missed, st.limit)}</span></div>
          <p class="course-name">{titleCase(c.name)}</p>
          <Meter missed={st.missed} limit={st.limit} />
        </a>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Course detail**

`src/ui/screens/CourseDetail.tsx`:
```tsx
import { useMemo, useState } from "preact/hooks";
import { markSession } from "../../domain/actions";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { hhmm } from "../../domain/time";
import type { Task } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate, fmtTime, titleCase } from "../format";
import { useNow } from "../useNow";
import { IconBack } from "../components/icons";
import { SessionGrid } from "../components/SessionGrid";
import { TaskRow } from "../components/TaskRow";
import { TaskSheet } from "../components/TaskSheet";

export function CourseDetail({ id }: { id: string }) {
  const state = useAppState();
  const now = useNow();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const course = state.courses.find((c) => c.id === id);
  const sessions = useMemo(() => generateSessions(state, now).filter((s) => s.courseId === id), [state, now, id]);
  const back = <a class="back" href="#/courses"><IconBack size={18} /> Courses</a>;
  if (!course) return <>{back}<div class="card muted">Course not found.</div></>;

  const st = courseStats(course, sessions);
  const history = sessions.filter((s) => s.status !== "upcoming").reverse();
  const tasks = state.tasks.filter((t) => t.courseId === id).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const barred = st.risk === "barred";
  const edit = (t: Task | null) => {
    setEditing(t);
    setOpen(true);
  };

  return (
    <>
      {back}
      <span class="chip">{course.code}</span>
      <h1 class="detail-title">{titleCase(course.name)}</h1>

      <div class="stats">
        <div class={`stat risk-${st.risk}`}><b>{barred ? "!" : st.canStillMiss}</b><span>{barred ? "Barred" : "can still miss"}</span></div>
        <div class="stat"><b>{st.currentStreak}</b><span>current streak</span></div>
        <div class="stat"><b>{st.bestStreak}</b><span>best streak</span></div>
      </div>

      <SessionGrid sessions={sessions} />

      <h2 class="section-title">History</h2>
      {history.length === 0 && <div class="card muted">No classes yet.</div>}
      {history.map((s) => (
        <div class="row" key={s.id}>
          <div class="grow"><b>{fmtDate(s.date)}</b><small>{fmtTime(hhmm(s.start))}</small></div>
          <div class="seg">
            <button class={s.status === "attended" ? "on ok" : ""} onClick={() => dispatch((x) => markSession(x, s.id, "attended"))}>Attended</button>
            <button class={s.status === "missed" ? "on bad" : ""} onClick={() => dispatch((x) => markSession(x, s.id, "missed"))}>Missed</button>
          </div>
        </div>
      ))}

      <h2 class="section-title">Tasks <button class="link" onClick={() => edit(null)}>+ Add</button></h2>
      {tasks.length === 0 && <div class="card muted">No tasks for this course.</div>}
      {tasks.map((t) => <TaskRow key={t.id} task={t} course={course} now={now} onOpen={() => edit(t)} />)}
      <TaskSheet open={open} task={editing} presetCourseId={id} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `mise x -- npx tsc`
Expected: clean.

In the browser (`?seed`): Courses tab lists cards sorted by most missed with colored meters; tapping one opens detail with back link; stats show can-still-miss / streaks; the grid shows green, dull-red and dim squares in order (compare `references/days-grid.jpeg`), and tapping a square shows its date/status; changing a History row from Attended to Missed updates the grid, stats, and the Courses meter; **+ Add** opens the task sheet with this course preselected. Visiting `#/course/NOPE` shows "Course not found." with a working back link.

- [ ] **Step 5: Commit**

```bash
git add src/ui && git commit -m "feat: courses list and course detail with session grid"
```

---

### Task 14: Settings — sync, prompts, permissions, backup

**Files:**
- Create: `src/ui/useSync.ts`, `src/ui/usePermissions.ts`, `src/ui/components/SyncParts.tsx`, `src/ui/components/PermissionRows.tsx`
- Modify: `src/ui/screens/Settings.tsx`

**Interfaces:**
- Consumes: `fetchTimetable`, `SyncError`, `CANCELLED` (Task 8), actions (Task 6), device + share helpers, store.
- Produces: `useSync(): { busy: boolean; error: Error | null; preview: ParsedSchedule | null; start(): Promise<void>; confirm(): void; cancel(): void }`, `usePermissions(): { status: PermissionStatus | null; refresh(): void }`, `<SyncPreviewSheet sync />`, `<SyncErrorCard sync />`, `<PermissionRows />` (all reused by Onboarding).

- [ ] **Step 1: Hooks**

`src/ui/useSync.ts`:
```ts
import { useState } from "preact/hooks";
import { applySync } from "../domain/actions";
import { ymd } from "../domain/time";
import type { ParsedSchedule } from "../iium/parser";
import { CANCELLED, fetchTimetable } from "../iium/sync";
import { dispatch } from "../store/store";

export function useSync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<ParsedSchedule | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await fetchTimetable());
    } catch (e) {
      if ((e as Error).message !== CANCELLED) setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!preview) return;
    const parsed = preview;
    dispatch((s) => applySync(s, parsed, ymd(new Date())));
    setPreview(null);
  }

  return { busy, error, preview, start, confirm, cancel: () => setPreview(null) };
}

export type SyncState = ReturnType<typeof useSync>;
```

`src/ui/usePermissions.ts`:
```ts
import { App as CapApp } from "@capacitor/app";
import { useEffect, useState } from "preact/hooks";
import { getPermissions } from "../native/device";
import type { PermissionStatus } from "../native/device";

export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const refresh = () => void getPermissions().then(setStatus);
  useEffect(() => {
    refresh();
    const handle = CapApp.addListener("resume", refresh);
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
  return { status, refresh };
}
```

- [ ] **Step 2: Shared sync and permission components**

`src/ui/components/SyncParts.tsx`:
```tsx
import { SyncError } from "../../iium/sync";
import { shareFile } from "../../native/share";
import { titleCase } from "../format";
import type { SyncState } from "../useSync";
import { Sheet } from "./Sheet";

export function SyncPreviewSheet({ sync }: { sync: SyncState }) {
  const p = sync.preview;
  return (
    <Sheet open={!!p} onClose={sync.cancel}>
      {p && (
        <>
          <h2>Found {p.courses.length} courses</h2>
          <p class="group-hint">{p.sessionName}{p.studentName ? ` · ${titleCase(p.studentName)}` : ""}</p>
          {p.courses.map((c) => (
            <div class="row" key={`${c.code}-${c.section}`}>
              <div class="grow"><b>{c.code}</b><small>{titleCase(c.name)}</small></div>
              <small>{p.slots.filter((s) => s.code === c.code && s.section === c.section).length}× / week</small>
            </div>
          ))}
          <button class="btn primary" onClick={sync.confirm}>Save timetable</button>
          <button class="btn ghost" onClick={sync.cancel}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}

export function SyncErrorCard({ sync }: { sync: SyncState }) {
  const err = sync.error;
  if (!err) return null;
  const html = err instanceof SyncError ? err.html : undefined;
  return (
    <div class="card">
      <p class="error">{err.message}</p>
      {html && <button class="btn" onClick={() => void shareFile("imaluum-schedule.html", html, "text/html")}>Share page for debugging</button>}
    </div>
  );
}
```

`src/ui/components/PermissionRows.tsx`:
```tsx
import { openBatterySettings, openExactAlarmSettings, requestNotifications } from "../../native/device";
import { usePermissions } from "../usePermissions";

export function PermissionRows() {
  const { status, refresh } = usePermissions();
  if (!status) return <div class="skeleton" />;
  const rows = [
    { ok: status.notifications, label: "Notifications", hint: "Needed for class prompts", fix: requestNotifications },
    { ok: status.exactAlarms, label: "Alarms & reminders", hint: "Prompts arrive right when class ends", fix: openExactAlarmSettings },
    { ok: status.battery, label: "Battery: unrestricted", hint: "Stops Nothing OS from delaying prompts", fix: openBatterySettings },
  ];
  return (
    <>
      {rows.map((r) => (
        <button key={r.label} class="row" onClick={() => !r.ok && void r.fix().finally(refresh)}>
          <div class="grow"><b>{r.label}</b><small>{r.hint}</small></div>
          <span class={r.ok ? "status-ok" : "status-bad"}>{r.ok ? "On" : "Fix"}</span>
        </button>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Settings screen**

`src/ui/screens/Settings.tsx`:
```tsx
import { useState } from "preact/hooks";
import { isPaused, parseImport, serialize, setPaused, setSemesterEnd, unlink, updateSettings } from "../../domain/actions";
import { ymd } from "../../domain/time";
import { DEFAULT_LIMIT } from "../../domain/types";
import type { AppState } from "../../domain/types";
import { shareFile } from "../../native/share";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate, initials, shortName } from "../format";
import { useSync } from "../useSync";
import { IconChevron } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { Sheet } from "../components/Sheet";
import { SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";
import { Toggle } from "../components/Toggle";

export function Settings() {
  const state = useAppState();
  const sync = useSync();
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const today = ymd(new Date());
  const acc = state.account;

  async function onImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      setImportError(null);
      setPendingImport(parseImport(await file.text()));
    } catch (err) {
      setImportError((err as Error).message);
    }
  }

  function confirmImport() {
    const imported = pendingImport;
    if (imported) dispatch(() => imported);
    setPendingImport(null);
  }

  return (
    <>
      <h1 class="page-title">Settings</h1>

      <div class="profile">
        <div class="avatar">{initials(acc?.name)}</div>
        <div>
          <b>{acc?.name ? shortName(acc.name) : "Not linked"}</b>
          <small>{acc ? `${acc.matric ?? "Matric unknown"} · synced ${fmtDate(acc.lastSync)}` : "Link your IIUM account to load your timetable"}</small>
        </div>
      </div>

      <p class="group-title">IIUM account</p>
      <p class="group-hint">You log in on IIUM's own page. Hadir never sees your password.</p>
      <button class="row" disabled={sync.busy} onClick={() => void sync.start()}>
        <div class="grow"><b>{acc ? "Re-sync timetable" : "Link IIUM account"}</b><small>{sync.busy ? "Working…" : "Pulls your courses from i-Ma'luum"}</small></div>
        <IconChevron />
      </button>
      {acc && (
        <button class="row" onClick={() => dispatch(unlink)}>
          <div class="grow"><b>Unlink account</b><small>Courses, attendance and tasks stay on this phone</small></div>
          <IconChevron />
        </button>
      )}
      <SyncErrorCard sync={sync} />

      {state.semester && (
        <>
          <p class="group-title">Semester</p>
          <label class="field">
            <span>{state.semester.label} ends on</span>
            <input
              type="date"
              min={state.semester.start}
              value={state.semester.end}
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (v) dispatch((s) => setSemesterEnd(s, v));
              }}
            />
          </label>
        </>
      )}

      <p class="group-title">Prompts</p>
      <div class="row">
        <div class="grow"><b>Pause prompts</b><small>For mid-sem break and holidays</small></div>
        <Toggle on={isPaused(state)} onChange={(v) => dispatch((s) => setPaused(s, v, today))} />
      </div>
      <label class="field">
        <span>Ask "Did you attend?"</span>
        <select value={String(state.settings.promptDelayMin)} onChange={(e) => dispatch((s) => updateSettings(s, { promptDelayMin: Number(e.currentTarget.value) }))}>
          {[0, 5, 10, 15].map((m) => <option key={m} value={String(m)}>{m === 0 ? "When class ends" : `${m} min after class`}</option>)}
        </select>
      </label>
      <label class="field">
        <span>Task reminder time (day before due)</span>
        <input
          type="time"
          value={state.settings.taskReminderTime}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (v) dispatch((s) => updateSettings(s, { taskReminderTime: v }));
          }}
        />
      </label>
      <div class="row">
        <div class="grow"><b>Absence warnings</b><small>Alert at {DEFAULT_LIMIT - 1} of {DEFAULT_LIMIT} missed</small></div>
        <Toggle on={state.settings.warningsEnabled} onChange={(v) => dispatch((s) => updateSettings(s, { warningsEnabled: v }))} />
      </div>

      <p class="group-title">Permissions</p>
      <PermissionRows />

      <p class="group-title">Backup</p>
      <button class="row" onClick={() => void shareFile(`hadir-backup-${today}.json`, serialize(state))}>
        <div class="grow"><b>Export data</b><small>Save a backup file (Drive, Telegram, …)</small></div>
        <IconChevron />
      </button>
      <label class="row">
        <div class="grow"><b>Import data</b><small>Replace everything with a backup file</small></div>
        <IconChevron />
        <input type="file" accept="application/json,.json" hidden onChange={(e) => void onImportFile(e)} />
      </label>
      {importError && <p class="error">{importError}</p>}

      <Sheet open={!!pendingImport} onClose={() => setPendingImport(null)}>
        <h2>Replace all data?</h2>
        <p class="group-hint">
          Everything on this phone will be replaced with the backup ({pendingImport?.courses.length ?? 0} courses, {pendingImport?.tasks.length ?? 0} tasks).
        </p>
        <button class="btn primary" onClick={confirmImport}>Replace</button>
        <button class="btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
      </Sheet>
      <SyncPreviewSheet sync={sync} />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `mise x -- npx tsc && mise x -- npm test`
Expected: clean.

In the browser with cleared site data (`http://localhost:5173/`): Settings → **Link IIUM account** (web uses the fixture) → preview sheet "Found 5 courses" → **Save timetable** → profile shows "Abdul Wahid · 2212345"; Home/Schedule/Courses now populated. Toggle **Pause prompts** on/off. Change semester end date; reload; persists. **Export data** downloads JSON; edit the file's `version` to 2 and **Import** it → red "Unsupported data version: 2", data unchanged; import the original → confirm sheet → **Replace** works. Permission rows show "On" (web stub).

- [ ] **Step 5: Commit**

```bash
git add src/ui && git commit -m "feat: settings — IIUM sync, prompts, permissions, backup"
```

---

### Task 15: Onboarding, back button, app icon

**Files:**
- Create: `src/ui/screens/Onboarding.tsx`, `assets/make-icon.py`
- Modify: `src/app.tsx`

**Interfaces:**
- Consumes: `useSync`, `SyncPreviewSheet`, `SyncErrorCard`, `PermissionRows`, `completeOnboarding`, `setSemesterEnd`.

- [ ] **Step 1: Onboarding**

`src/ui/screens/Onboarding.tsx`:
```tsx
import { useState } from "preact/hooks";
import { completeOnboarding, setSemesterEnd } from "../../domain/actions";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate } from "../format";
import { useSync } from "../useSync";
import { IconCheck } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";

export function Onboarding() {
  const state = useAppState();
  const sync = useSync();
  const [step, setStep] = useState(0);
  const linked = state.courses.some((c) => c.active);

  if (step === 0) {
    return (
      <div class="onboard">
        <div class="logo"><IconCheck size={30} /></div>
        <h1>Hadir</h1>
        <p>Track attendance and tasks for your IIUM classes, so you never get barred.</p>
        <p>Link your IIUM account to pull your timetable from i-Ma'luum. You log in on IIUM's own page — Hadir never sees your password.</p>
        {linked ? (
          <>
            <div class="card">Timetable saved: {state.courses.filter((c) => c.active).length} courses</div>
            <button class="btn primary" onClick={() => setStep(1)}>Continue</button>
          </>
        ) : (
          <>
            <button class="btn primary" disabled={sync.busy} onClick={() => void sync.start()}>{sync.busy ? "Linking…" : "Link IIUM account"}</button>
            <button class="btn ghost" onClick={() => setStep(1)}>Skip for now</button>
          </>
        )}
        <SyncErrorCard sync={sync} />
        <SyncPreviewSheet sync={sync} />
      </div>
    );
  }

  if (step === 1 && state.semester) {
    const sem = state.semester;
    return (
      <div class="onboard">
        <h1>Semester</h1>
        <p>Classes count from {fmtDate(sem.start)}. When does {sem.label} end? You can change this later in Settings.</p>
        <label class="field">
          <input
            type="date"
            min={sem.start}
            value={sem.end}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v) dispatch((s) => setSemesterEnd(s, v));
            }}
          />
        </label>
        <button class="btn primary" onClick={() => setStep(2)}>Continue</button>
      </div>
    );
  }

  return (
    <div class="onboard">
      <h1>Notifications</h1>
      <p>Hadir asks "Did you attend?" after each class. Turn these on so the prompts arrive on time.</p>
      <PermissionRows />
      <button class="btn primary" onClick={() => dispatch(completeOnboarding)}>Finish</button>
    </div>
  );
}
```

- [ ] **Step 2: Gate and back button in the shell**

In `src/app.tsx`:

Add imports at the top:
```tsx
import { App as CapApp } from "@capacitor/app";
import { useEffect } from "preact/hooks";
import { go, parseHash } from "./ui/router";
import { Onboarding } from "./ui/screens/Onboarding";
```
(merge `go, parseHash` into the existing `./ui/router` import line rather than duplicating it.)

Add this hook above `export function App()`:
```tsx
function useBackButton() {
  useEffect(() => {
    const handle = CapApp.addListener("backButton", () => {
      const r = parseHash(location.hash);
      if (r.courseId) history.back();
      else if (r.tab !== "home") go("#/home");
      else void CapApp.exitApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}
```

Inside `App()`, replace `useAppState();` with:
```tsx
  const state = useAppState();
  useBackButton();
```
and directly after the `if (status.error) …` line add:
```tsx
  if (!state.onboarded) return <Onboarding />;
```

- [ ] **Step 3: App icon**

`assets/make-icon.py`:
```python
"""Generates Hadir icon sources for @capacitor/assets: green tile with a dark check mark."""
from PIL import Image, ImageDraw

GREEN, DARK, S = (72, 222, 124, 255), (6, 33, 15, 255), 1024


def check(draw, scale, offset):
    pts = [(300, 540), (450, 690), (740, 360)]
    pts = [(offset + x * scale, offset + y * scale) for x, y in pts]
    draw.line(pts, fill=DARK, width=int(110 * scale), joint="curve")
    for x, y in (pts[0], pts[-1]):
        r = 55 * scale
        draw.ellipse([x - r, y - r, x + r, y + r], fill=DARK)


full = Image.new("RGBA", (S, S), GREEN)
check(ImageDraw.Draw(full), 1.0, 0)
full.save("assets/icon-only.png")

fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
check(ImageDraw.Draw(fg), 0.62, S * 0.19)  # keep inside the adaptive-icon safe zone
fg.save("assets/icon-foreground.png")

Image.new("RGBA", (S, S), GREEN).save("assets/icon-background.png")
```

Run:
```bash
python3 assets/make-icon.py
mise x -- npx @capacitor/assets generate --android
```
Expected: `assets/icon-*.png` created; generator reports Android mipmap icons written under `android/app/src/main/res/`.

- [ ] **Step 4: Verify**

Run: `mise x -- npx tsc && mise x -- npm test`
Expected: clean.

In the browser with cleared site data: onboarding appears; **Link IIUM account** → preview → save → "Timetable saved: 5 courses" → Continue → semester end step → Continue → notifications step → **Finish** → Home. Clear again and use **Skip for now** → lands directly on the notifications step (no semester) → Finish → Home with Link card.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: onboarding flow, Android back button, app icon"
```

---

### Task 16: On-device verification (Nothing Phone 2)

**Files:**
- Modify only if a check below fails (fix, re-run, note in commit).

- [ ] **Step 1: Build and install**

Run: `mise x -- npm test && mise x -- npm run apk && mise x -- npm run install:phone`
Expected: tests pass, `BUILD SUCCESSFUL`, `Success`.

- [ ] **Step 2: Walk through with the user**

Ask the user to do each step and report what they see. Expected results in brackets.

1. Open Hadir → onboarding → **Link IIUM account** → log in on IIUM page. [Preview lists their real courses; Save → semester step shows today as start.]
2. Finish permissions: allow notifications; tap **Alarms & reminders** → enable for Hadir → back; tap **Battery** → set Hadir to *Unrestricted* → back. [All three rows show "On" after returning.]
3. Home. [Greeting with their name; now/next card matches their real timetable; content not hidden under the status bar or nav bar.]
4. Schedule. [Blocks match i-Ma'luum / Aurum; tap block → sheet.]
5. Settings → prompt delay 0. Wait for the end of the next real class, or temporarily: Settings → Re-sync is not needed — instead, for a quick test, ask the user to wait for any class end today. [Notification "Did you attend …?" with **Attended** / **Missed** buttons arrives within ~1 min of class end.]
6. Tap **Missed** on the notification. [App opens on Home; that class isn't in Unmarked; Courses meter shows 1 / 6.]
7. Tasks → add a task due tomorrow 23:59 with reminder time set to a few minutes from now in Settings. [Reminder "Due tomorrow: …" arrives at that time.]
8. Course detail → change a History row. [Grid square and stats update.]
9. Settings → **Export data** → save to Files/Drive. Then **Import data** with that file → **Replace**. [Same data afterwards.]
10. Android back button: from Course detail → Courses; from any tab → Home; from Home → app closes.
11. Kill the app from recents, reopen. [Data intact; no duplicate notifications appear for the same class.]

- [ ] **Step 3: Fix known-risk failures**

- Content under status bar (check 3): in `src/ui/theme.css` change `.screen` and `.onboard` top padding to `max(env(safe-area-inset-top), 36px)`; rebuild/reinstall.
- CAS login dialog's top hidden under status bar: in `HadirPlugin.showLogin`, add `web.setFitsSystemWindows(true);` before `dialog.setContentView(web);`; rebuild/reinstall.
- Prompt arrives late (>5 min, check 5): confirm check 2 rows are "On"; check `mise x -- adb shell dumpsys alarm | grep -A3 com.awk.hadir` shows scheduled alarms.
- Anything else: `mise x -- adb logcat -s Capacitor:* Capacitor/Console:* AndroidRuntime:*` while reproducing, then use superpowers:systematic-debugging.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: on-device adjustments for Nothing Phone 2" # only if changes were made
```
