# Class Tracker — Design Spec

Date: 2026-10-05
Status: Approved. Revised 2026-10-05: timetable now comes from the confirmation slip PDF, not an in-app i-Ma'luum login (§4).

## 1. Purpose

Personal Android app for one IIUM Gombak student to:

1. Track how many classes were missed per course, so they never exceed the bar limit.
2. Track assignments (tasks) and get reminded before they are due.

Success = after each class the user gets a prompt, answers with one tap, and can see at any moment how many more absences each course allows.

### Decisions (from user)

| Topic | Decision |
|---|---|
| Platform | Native Android app (Capacitor), sideloaded APK. Target device: Nothing Phone 2, Android 16. |
| Course data | Imported from i-Ma'luum's Course Registration Confirmation Slip, printed to PDF by the user (once per semester or when classes change). |
| Login | None. The app never talks to IIUM servers. |
| Bar rule | Max absences per course, default **6** (one limit per course, not split by session type). |
| Attendance input | Notification after each class with **Attended / Missed** actions. Ignored = stays unmarked (never auto-counted). |
| Assignments | Title, course, due date/time, optional note, done flag, reminder before due. |
| Backend | None. All data on device. Export/import JSON for backup. |
| Visual style | Inspired by Aurum (dark theme, green accent, serif headings, rounded cards, bottom tab bar). See `references/`. |

### Out of scope

Grades/GPA, exams, sharing, multiple users, cloud sync, iOS, Play Store distribution, pulling attendance from IIUM.

## 2. Architecture

```
┌────────────────────────── Android APK ───────────────────────────┐
│  Web UI (Vite + Preact + TypeScript) in Capacitor WebView        │
│   ├─ screens/            Home, Schedule, Tasks, Courses,         │
│   │                      CourseDetail, Settings                  │
│   ├─ domain/             pure logic (no Capacitor imports)       │
│   │   ├─ sessions.ts     generate sessions from slots + semester │
│   │   ├─ attendance.ts   counts, remaining, streaks              │
│   │   └─ parser.ts       confirmation slip text → courses/slots  │
│   ├─ store/              persistence (Capacitor Preferences,     │
│   │                      single JSON document, versioned)        │
│   ├─ notify/             schedules local notifications           │
│   └─ iium/               import flow: PDF (pdf.js) → parser      │
│                                                                  │
│  Native (Java — matches Capacitor template, no Kotlin setup)     │
│   └─ HadirPlugin (Java)  battery settings                        │
└──────────────────────────────────────────────────────────────────┘
```

Boundaries:

- `domain/` is pure TypeScript; fully unit-testable with Vitest, no device needed.
- `iium/` is the only code that talks to IIUM. Parser takes an HTML string, returns data — tested against saved fixture HTML.
- `notify/` is the only code that touches `@capacitor/local-notifications`.
- `store/` is the only code that reads/writes persisted data.

## 3. Data model

Stored as one JSON document with `version: 1`.

```ts
type Course = {
  id: string;            // `${code}-${section}`, e.g. "BICS 4350-1"
  code: string;          // "BICS 4350"
  name: string;          // "Privacy Engineering"
  section: string;
  color: number;         // palette index, assigned at sync
  absenceLimit: number;  // default 6
  active: boolean;       // false when dropped from i-Ma'luum on re-sync
};

type Slot = {            // weekly recurring class
  id: string;
  courseId: string;
  day: 0|1|2|3|4|5|6;    // 0 = Sunday
  start: string;         // "11:30" local (Asia/Kuala_Lumpur)
  end: string;           // "12:50"
  venue: string;
  lecturer: string;
};

type Session = {         // one concrete occurrence of a slot
  id: string;            // `${slotId}@${YYYY-MM-DD}`
  slotId: string;
  courseId: string;
  date: string;          // YYYY-MM-DD
  status: "upcoming" | "unmarked" | "attended" | "missed";
};

type Task = {
  id: string;
  courseId: string | null;
  title: string;
  due: string;           // ISO datetime
  note: string;
  done: boolean;
};

type Settings = {
  account: { name: string; matric: string; lastSync: string } | null;
  semester: { start: string; end: string; label: string } | null; // label e.g. "Sem 1, 2026/2027"
  paused: boolean;
  promptDelayMin: number;      // minutes after class end, default 0
  taskReminderTime: string;    // "20:00", day before due
  warningsEnabled: boolean;    // default true
};
```

Rules:

- Semester dates come from IIUM's official academic calendar bundled in the app (`domain/calendar.ts`, 2026/2027 Sem 1–3): `start` = first lecture day, `end` = last lecture day, mid-semester break added as a pause interval. Semester not in the table → `start` = import date, `end` = start + 14 weeks. End editable in Settings.
- Sessions are generated lazily for the semester range from slots, skipping dates inside pause intervals (`pauses: {from, to|null}[]`) — except sessions already marked, which are always kept.
- Session status: `upcoming` before end time; becomes `unmarked` after end time until answered.
- Missed count = sessions with `missed`. `absenceLimit` (6) is the absence count that bars you, so **can still miss** = `max(0, absenceLimit − 1 − missed)` and barred = `missed ≥ absenceLimit`. Risk: amber at `limit − 2` (4), red at `limit − 1` (5), "Barred" at `limit`.
- Re-sync replaces courses/slots; keeps existing sessions/tasks whose `courseId` still exists. Courses that disappear are kept in data but hidden (history not lost).

## 4. Timetable import (confirmation slip PDF)

Revised after the device test: the in-app CAS login worked, but i-Ma'luum's schedule page loads its data through JavaScript and rejects non-browser requests (HTTP 403). The confirmation slip is a fixed, server-printed table with explicit AM/PM, so the user imports that instead.

1. User opens i-Ma'luum → Course Registration Confirmation Slip → Print → Save as PDF.
2. Onboarding / Settings → "Import confirmation slip" opens the system file picker (`application/pdf`).
3. pdf.js extracts positioned text; `groupRows` rebuilds lines by y-position; `parseSlip` reads:
   - header: `Session : 2026/2027` + `Semester : 1` → label "Sem 1, 2026/2027"; matric; name.
   - course rows: code, section, title, credit hours, day (`M-W`, `T-TH`, `MON`…), time `h.mm - h.mm AM|PM`, venue. Rows without a time keep the course with no slots; a time row without a course code adds a slot to the course above.
   - time rule: AM/PM belongs to the end time; 12 is always noon (the slip prints "11.30 - 12.50 AM" for a noon class); the start moves to PM only if it stays before the end.
4. Show preview ("Found 7 courses") → confirm → save. Re-importing works like a re-sync (§3): moved slots are kept as history so past marks still count.

Errors: unreadable file → "Couldn't open that file…"; zero courses → "No courses found…" with how to get the slip. Existing data untouched in both cases.

## 5. Screens

Visual style emulates Aurum (`references/*.jpeg`); colors sampled from the screenshots. Own app icon/logo (no Aurum branding). Dark only.

**Color tokens**

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0C0E` | page background, tab bar |
| `surface` | `#131416` | cards, list rows, sheets |
| `border` | `#1E1F21` | 1px card/row borders |
| `accent` | `#48DE7C` | headings, active tab, progress, attended squares, primary buttons |
| `accent-dim` | `#15331F` | grid squares (upcoming/unmarked), chip bg, inactive day-tab border |
| `hero` | `#0C1B14` | now/next card bg (green-tinted, subtle green border + glow) |
| `text` | `#F2F2F2` | primary text |
| `text-muted` | `#7C7D7F` | secondary text, inactive tab icons |
| `danger` | `#E9777C` on `#3A1416` | overdue, red meter, warning chips (Aurum's "UPCOMING" pill) |
| `missed` | `#6B2E30` | dull red grid squares |
| `warn` | `#F5B53D` | amber meter, glowing outline on warning cards (Aurum's "Upgrade" card style) |

Course block palette (dark fill / bright text), assigned in order at sync:
orange `#421A00`/`#FFA65C`, purple `#3A0763`/`#D9A8FF`, olive `#192E03`/`#C6F25A`, indigo `#1D1B4A`/`#A9B1FF`, teal `#083343`/`#67E0F5`, brown `#3D2600`/`#FFD84D`, rose `#3F0A1E`/`#FF8FB5`, slate `#1A2733`/`#9CC3E6`.

**Typography** (bundled locally, works offline)
- Display/headings: **Libre Baskerville** bold — page titles ("Activities"-style, green, centered), greeting name, section headings ("Quick Links"-style, green, left).
- UI/body: **Manrope** — card titles 600, body 400, small caps-ish chips 700.

**Shape & layout**
- Radius: cards 16px, chips/pills 999px, grid squares 6px, day tabs 10px, course blocks 14px.
- Cards: `surface` fill + 1px `border`, 16–20px padding, 12px gaps, 20px screen gutter.
- List rows (Settings/Courses): Aurum's "Quick Links" row — icon left, title + muted subtitle, chevron/arrow right.
- Bottom tab bar: outline icons + label, active = `accent` filled icon + label.
- Schedule: Aurum's grid — day tabs as pills (active filled `accent` with dark text), time labels right-aligned in muted, dashed hour lines, blocks show start time top-left, code large, name small, end time bottom-right; dashed "now" line with time label.
- Skeleton shimmer placeholders while loading (Aurum's Activities style).
- Motion: subtle only — sheet slide-up, progress bar, press scale 0.98.

Bottom tabs: **Home · Schedule · Tasks · Courses · Settings**.

### Home
- Greeting + name.
- Now/next card: current class with time-left progress bar, venue; below it the next class (Aurum style). Empty state: "No more classes today".
- **Unmarked** list: each past unanswered session with Attended / Missed buttons inline.
- **Warnings**: courses with missed ≥ 4 (amber 4, red ≥ 5).
- **Due soon**: next 3 not-done tasks; tap → Tasks.

### Schedule
- Header: semester label.
- Day header pills, one column per day that has classes (as in Aurum's screenshot); today's pill filled green.
- Time grid with colored course blocks (code, name, start/end), dashed "now" line with time label.
- Tap block → bottom sheet: course name, time, venue, lecturer, missed X / limit, link to Course detail.

### Tasks
- Sections **Upcoming** (count) and **Past** (count). Overdue not-done tasks at top of Upcoming in red. Past = done tasks (newest due first). Not-done tasks always stay in Upcoming, however late.
- Row: title, course code, due relative ("in 2 days"), checkbox.
- `+` button → bottom sheet form: title (required), course (picker, optional), due date + time (required), note. Same sheet for edit; delete in sheet.

### Courses
- Card per course: code, name, meter `X / limit` (green < 4, amber 4, red ≥ 5). Sorted by missed desc.
- Tap → Course detail.

### Course detail
- Header: code + name.
- Stats row: **Can still miss N** · **Current streak** (consecutive attended, most recent backwards, unmarked sessions skipped) · **Best streak**.
- **Session grid**: one rounded square per session of the semester, chronological, flowing/wrapping. Colors: green = attended, dull red = missed, dim = upcoming or unmarked. Tap square → shows date + status.
- **History** list: past sessions newest first, date + status; tap to change Attended ↔ Missed.
- **Tasks** for this course + add button (opens task sheet preset to course).

### Settings
- Timetable: name, matric, last import date, **Import confirmation slip** / **Import new slip**.
- Semester end date.
- **Pause prompts** toggle.
- Notifications: prompt delay after class (0/5/10/15 min), task reminder time, absence warnings on/off.
- Permissions status: notifications, exact alarms, battery optimization — each with a button to open the relevant system setting.
- **Export data** (JSON via share sheet) / **Import data** (file picker, validates `version`, confirms overwrite).

## 6. Notifications

Library: `@capacitor/local-notifications`.

| Kind | When | Content | Actions |
|---|---|---|---|
| Attendance prompt | slot end + promptDelayMin, each non-paused session | "Did you attend BICS 4350?" / course name, venue | **Attended**, **Missed** |
| Task reminder | day before `due` at `taskReminderTime`; skipped if that moment already passed | "Due tomorrow: <title>" | tap → Tasks |
| Absence warning | when a course reaches limit − 1 missed | "BICS 4350: 5 / 6 missed — one more and you're barred" | tap → Course detail |

- Action buttons update session status via listener `localNotificationActionPerformed`. On Android the Capacitor plugin brings the app to the foreground when an action is tapped (app opens on Home, already marked). Tapping the body opens Home.
- Scheduling window: keep notifications scheduled for the next 14 days; re-schedule on app open, after sync, after settings/pause changes, after task edits. (Avoids Android's pending-alarm limits.)
- Stable notification IDs derived from session/task id hash so re-scheduling replaces, not duplicates.

### Android 16 / Nothing OS requirements

- `POST_NOTIFICATIONS` runtime permission — request on first launch after onboarding.
- Exact timing: `SCHEDULE_EXACT_ALARM` is denied by default for new installs on Android 14+; app links to "Alarms & reminders" setting. Without it, prompts may arrive late (acceptable, still works).
- Nothing OS battery management may delay/kill alarms: Settings screen links to battery optimization exemption.
- Target current Capacitor major and its default `targetSdk`; min SDK per Capacitor default.

## 7. Onboarding (first launch)

1. Welcome → "Import confirmation slip" (§4).
2. Confirm semester end date (default start + 14 weeks).
3. Grant notification permission → prompt for exact alarms + battery exemption (skippable).
4. Land on Home.

## 8. Error handling

- No data yet → empty states with an "Import your confirmation slip" CTA on Home/Schedule/Courses.
- Sync failures → inline error, existing data untouched.
- Import with bad file → error, no overwrite.
- Persisted data with unknown `version` → refuse load, offer export of raw data (no silent loss).

## 9. Testing

- **Unit (Vitest)**: `parser.ts` against synthetic slip rows (multi-day rows, continuation rows, rows without time, AM/PM at noon) plus the user's real slip PDF when present locally (gitignored); `sessions.ts` (generation across weeks, pause intervals, semester bounds, timezone Asia/Kuala_Lumpur); `attendance.ts` (missed, remaining, current/best streak with unmarked gaps); notification schedule planner (pure function: state → list of notifications).
- **Manual on device**: install APK, import the slip PDF, verify courses; set prompt delay so a prompt fires; tap Missed from notification shade → meter/grid update; add task due tomorrow → reminder fires; export → import round-trip.

## 10. Build & install

- Dev: `npm run dev` (browser, with mocked Capacitor plugins + fixture data).
- APK: `npx cap sync android` → Gradle `assembleDebug` → `adb install` (or copy APK to phone).
- Requires Android SDK + JDK on the Linux machine (setup is a plan step).

## 11. Risks

1. **Cookie capture vs. real CAS** — resolved: replaced by PDF import (§4).
2. **Slip format changes** — a new layout breaks import; stored data unaffected; parser fails loudly with "No courses found".
3. **Alarm delivery on Nothing OS** — mitigated by exact-alarm + battery settings links.
4. **No cloud backup** — mitigated by export/import.
