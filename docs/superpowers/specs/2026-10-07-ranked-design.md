# Ranked — design

A gamified rank for the degree. Result slips from i-Ma'luum give each semester an official
tier; during a semester an Elo rating moves with assignments; achievements (Minecraft-style
advancements, some secret) mark milestones. Everything is computed by the app from stored
data — PDFs are inputs only. Lives on a new **Ranked** tab. Nothing leaves the phone.

## What the user said

- Rank tiers S to F from GPA, IIUM's 4.00 scale.
- Semester rank per semester; Degree rank across all semesters, **computed by the app** so it
  stays consistent and doesn't depend on a PDF each time.
- Input is the IIUM result slip PDF. Past semesters not yet imported must all be uploaded.
- Elo moves with assignments for now (more inputs later), shown with a progress bar.
- Badges look like **MCSR Ranked**'s pixel-art rank badges (Coal → Netherite).
- Achievements inspired by Minecraft advancements; names that only make sense in Minecraft
  are renamed. Secret achievements drawn from IIUM regulations, plus a COND. PASS streak.
- Every course has a final assignment — it should be special.
- Ranked replaces Settings in the tab bar; Settings moves behind a gear on Home.
- "The End." unlocks from a "Finished my last paper" button in the Tasks tab.

## Assumptions (correct me)

- GPA tiers and MCSR ores are **one ladder** (S = Netherite … F = Coal); Elo divisions give
  finer steps inside it.
- Badge art is **drawn for Hadir** in MCSR's style (pixel grid, gem shapes growing with rank,
  same palette) — not MCSR's image files, which are theirs.
- Grade points below 2.00 count as a fail (matches the slip, which puts a D on RPT).
- Tasks already done before this ships have no completion time; they count as on time.

## Success criteria

1. Importing the user's Sem 2 2025/2026 slip gives GPA 1.95 (computed = printed), tier F / Coal.
2. Importing every past slip makes the computed CGPA and cumulative credit hours equal the
   latest slip's printed 2.54 / 68.5, and the Degree rank unlocks (C / Gold).
3. With a semester missing, the Degree badge stays Unrated and says which check failed.
4. Ticking a task on time raises Elo by the stated amount; unticking takes it back.
5. Each achievement unlocks exactly once, with a toast, and stays unlocked.
6. Name, IC/passport and matric number from the slip are never stored.

## Tiers, ores and Elo

| Tier | GPA | Ore | Elo — divisions I / II / III |
|---|---|---|---|
| S | 3.67–4.00 | Netherite | 2000+ (no divisions) |
| A | 3.50–3.66 | Diamond | 1500 / 1650 / 1800 |
| B | 3.00–3.49 | Emerald | 1200 / 1300 / 1400 |
| C | 2.50–2.99 | Gold | 900 / 1000 / 1100 |
| D | 2.00–2.49 | Iron | 600 / 700 / 800 |
| F | 0.00–1.99 | Coal | 0 / 400 / 500 |

Unrated (`?` badge) shows wherever there is not enough data.

**GPA → Elo** (placement) is piecewise linear between the tier floors:
GPA `0, 2.00, 2.50, 3.00, 3.50, 3.67, 4.00` → Elo `0, 600, 900, 1200, 1500, 2000, 2300`.
So 1.95 → 585 (Coal III), 2.54 → 924 (Gold I).

## Inputs

### Result slip (new parser, `src/iium/results.ts`)

Read with the existing `readPdf` + `groupRows`. Extract:

- session + semester → label `Sem 2, 2025/2026` (same format as `IIUM_CALENDAR`)
- per course: code, title, credit hours, grade code, grade point
- printed GPA, CGPA, total and cumulative credit hours, status (e.g. `COND. PASS`), remarks

Name, IC/passport and matric lines are skipped, not parsed. A slip whose rows don't fit the
format is rejected with a message, nothing saved. Re-importing a semester replaces it; if any
grade changed, that feeds **Objection!**.

### Confirmation slip (existing parser)

`parseSlip` also reads the `Chr` column into `Course.credits`, so credit load is known during
the semester.

### Tasks

`Task` gains `completedAt?: string` (set when ticked, cleared when unticked) and
`final?: boolean` (a "Final assignment" switch in the task sheet; finals get a distinct row
style).

## Computation (`src/domain/ranked.ts`, pure functions, unit-tested)

**Grade codes.** Letter grades carry their point. `Y` and `FR` count as 0.00 with their
credits. `P PA W AU EX IP I AP CO *` are excluded from GPA. Unknown codes are excluded and
listed in the mismatch warning.

**Semester GPA** = Σ(credits × point) ÷ Σ(credits) over that slip's counted courses.

**CGPA** over all imported slips, per course code: if any attempt passed (≥ 2.00), keep the
best attempt; otherwise keep the latest (IIUM §15–16, the replaced grade becomes RPT).

**Checks.** Each slip: computed GPA vs printed GPA. Latest slip: computed CGPA and cumulative
credit hours vs printed. The Degree rank shows only when the latest slip's checks pass —
that is how "all past semesters imported" is detected. Any mismatch shows the two numbers.

**Season Elo** (current semester) = placement + Σ task deltas, recomputed from state every
time (never stored):

- placement = GPA → Elo of the latest slip before this semester; none → 900, badge Unrated
- task due this semester, done by its due time: **+15** (final: **+45**)
- done after its due time: **−10**
- past due and not done: **−20** (final: **−60**)
- floor 0

The bar shows progress from the current division's floor to the next.

## Ranked screen

Pixel font (an OFL-licensed Minecraft-style font) for headings and numbers on this screen only.

1. **Season** — large badge (ore + division), Elo, bar to next division, last few Elo changes
   ("+45 Final: BICS 4340").
2. **Degree** — badge for computed CGPA tier, CGPA to 2 dp; Unrated with the reason when locked.
3. **History** — one small badge per imported semester, oldest first; tap → that slip's courses.
4. **Import result slip** button.
5. **Achievements** — grid of pixel tiles; locked are greyed, secret ones show `???` until
   unlocked.

Badges are inline SVG on a pixel grid (`shape-rendering: crispEdges`), one per ore plus
Unrated; division shown as I / II / III. Crossing into a new ore plays a short promotion
animation.

**Toast** on unlock, Minecraft-style, top of screen: yellow "Advancement Made!" for normal,
purple "Challenge Complete!" for secret.

## Navigation

Tab bar: Home, Schedule, Tasks, Courses, **Ranked**. Settings opens from a gear in the Home
header.

**Finished my last paper** button on Tasks, shown from the day after `semester.end` for
35 days or until tapped. Stores the semester label in `state.examsDone`.

## Achievements

Stored as `state.achievements: Record<id, unlockedAt>`. A checker runs on every state change
and records new unlocks; achievement conditions are pure functions of state.

### Visible

| Name | Trigger |
|---|---|
| Taking Inventory | Import your first timetable |
| Roll Call | Mark your first class |
| We Need to Go Deeper | Semester passes its midpoint |
| The End? | Day after `semester.end` (finals start, IIUM §29: week 15) |
| The End. | Tap "Finished my last paper" |
| Results Are In | Import the result slip for a semester you tracked |
| The End... Again... | "Finished my last paper" in a second semester |
| The Next Generation | Tap "I've graduated" (shown on Ranked after a slip import) |
| Full House | Perfect attendance in one course for a whole semester |
| Perfect Record | Perfect attendance in every course for a whole semester |
| Serious Dedication | 100 classes attended in total |
| Adventuring Time | Attend classes in 10 different venues |
| Sweet Dreams | Miss a class starting before 9:00 |
| Not Today, Thank You | One absence from the limit, then finish the semester without being barred |
| Checked Off | Complete your first task |
| Ten Down | 10 tasks done on time |
| Ahead of the Curve | Finish a task 7+ days before it's due |
| Photo Finish | Finish a task in the last hour before it's due |
| Monster Hunter | Finish a Final assignment |
| Monsters Hunted | Finish every course's Final on time in one semester |
| Placement Match | First result slip imported |
| Level Up | Semester tier higher than the previous semester's |
| Overpowered | Dean's List: GPA ≥ 3.50, ≥ 12 credits, no fails |
| Flawless | Semester GPA 4.00 |
| Top of the Class | Reach S, semester or degree |
| How Did We Get Here? | 23+ credit hours in a semester |
| Redemption Arc | Pass a course you failed before |
| Those Were the Days | Import a slip from before your current semester |

"Whole semester" attendance is judged once The End? is reached.

### Secret

| Name | Trigger | Source |
|---|---|---|
| Voluntary Exile | Barred (absences ≥ limit) or a `Y` grade | §33 |
| Dean's Blessing | More than 20 credit hours | §5.2 |
| Summer Grind | Take a short semester (Sem 3) | §5.2 |
| Tactical Retreat | A `W` grade | §9 |
| Just Visiting | An `AU` grade | §19 |
| Skip the Tutorial | An `EX` grade | §22, §25 |
| To Be Continued... | An `IP` grade | §14 |
| Perfectionist | Retake a course you'd already passed | §16 |
| Last Chance Saloon | A `PR` grade | §17 |
| Objection! | Re-imported slip with a changed grade | §35 |
| Back from the Brink | CGPA below 2.00, later back to ≥ 2.00 | §37 |
| Speedrun | The Next Generation with exactly 4 regular semesters imported | §40 |
| A Balanced Diet | Every letter grade A to F across your slips | — |
| Bare Minimum | Semester GPA exactly 2.00 | — |
| Copy Paste | Same grade in every course of a semester | — |
| Fasting Scholar | Perfect attendance on every class day in Ramadan (Hijri via `Intl`, `islamic-umalqura`) | — |
| What Am I Doing? | COND. PASS 2 regular semesters in a row | — |
| You Need to Lock In | COND. PASS 4 regular semesters in a row | — |

Streaks count regular semesters only; a Sem 3 in between neither counts nor breaks them.

## Data model changes

- `Course.credits?: number`
- `Task.completedAt?: string`, `Task.final?: boolean`
- `AppState.results: SemesterResult[]` (label, courses, printed GPA/CGPA/credit totals, status,
  remarks, importedAt)
- `AppState.examsDone: string[]`, `AppState.graduated?: string`
- `AppState.achievements: Record<string, string>`

`parseImport` fills missing fields with defaults, so existing saved state loads unchanged.

## Phases

1. **Slip import + Ranked tab** — results parser, GPA/CGPA/checks, tiers, badges, Season
   (placement only), Degree, History, tab bar + gear.
2. **Elo + Finals** — `completedAt`, `final`, Elo deltas, bar, promotion animation.
3. **Achievements** — checker, toasts, grid, last-paper and graduated buttons, `Chr` column.

## Testing

- Parser: the user's slip text (personal lines replaced) → expected courses and totals;
  personal fields absent from output.
- `ranked.ts`: GPA, CGPA with repeats (fail→pass, pass→lower retake), checks, GPA→Elo,
  divisions, Elo deltas.
- Each achievement condition: one unlocking and one non-unlocking state.
- Ranked screen render test: locked Degree, secret tiles hidden.
- Verify on phone: import real slips, compare against i-Ma'luum numbers.

## Out of scope

- Elo inputs other than tasks (attendance etc.) — later.
- Sharing ranks, leaderboards, other students.
- Programmes with non-standard grading (Medicine, Dentistry).
