import { courseStats } from "./attendance";
import { onTime } from "./elo";
import { LETTER_POINTS, cgpa, countedPoint, degree, gpa, isFail, labelKey, sortResults, tierOf } from "./grades";
import { generateSessions } from "./sessions";
import { addDays, hhmm, parseYmd, ymd } from "./time";
import type { AppState, Course, SemesterResult, Session } from "./types";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  secret?: true;
}

interface Ctx {
  s: AppState;
  now: Date;
  today: string;
  sessions: Session[];
  active: Course[];
  results: SemesterResult[]; // oldest first
  ended: boolean; // current semester's classes are over
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const regular = (r: SemesterResult) => !r.label.startsWith("Sem 3");
const anyGrade = (c: Ctx, g: string) => c.results.some((r) => r.courses.some((x) => x.grade === g));
const rGpa = (r: SemesterResult) => gpa(r.courses);
const slipCredits = (r: SemesterResult) => r.courses.reduce((n, x) => n + x.credits, 0);
const maxCredits = (c: Ctx) => Math.max(0, ...c.results.map(slipCredits), c.active.reduce((n, x) => n + (x.credits ?? 0), 0));
const done = (c: Ctx) => c.s.tasks.filter((t) => t.done && t.completedAt);
const early = (t: { due: string; completedAt?: string }) => Date.parse(t.due) - Date.parse(t.completedAt!);
const perfect = (c: Ctx, course: Course) => {
  const list = c.sessions.filter((x) => x.courseId === course.id);
  return list.length > 0 && list.every((x) => x.status === "attended");
};
const missed = (c: Ctx, course: Course) => courseStats(course, c.sessions).missed;
const hijriMonth = (d: Date) => Number(new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone: "Asia/Kuala_Lumpur" }).formatToParts(d).find((p) => p.type === "month")?.value);

/** Attempts per course code in slip order, counted grades only. */
function attempts(c: Ctx): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of c.results) for (const x of r.courses) {
    const p = countedPoint(x);
    if (p !== null) m.set(x.code, [...(m.get(x.code) ?? []), p]);
  }
  return m;
}

function condStreak(c: Ctx): number {
  let best = 0;
  let run = 0;
  for (const r of c.results.filter(regular)) {
    run = /COND/i.test(r.status) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function midpoint(start: string, end: string): string {
  const days = Math.round((parseYmd(end).getTime() - parseYmd(start).getTime()) / DAY);
  return addDays(start, Math.floor(days / 2));
}

type Def = Achievement & { check: (c: Ctx) => boolean };

const DEFS: Def[] = [
  // Semester timeline
  { id: "taking-inventory", name: "Taking Inventory", desc: "Import your first timetable", check: (c) => c.s.courses.length > 0 },
  { id: "roll-call", name: "Roll Call", desc: "Mark your first class", check: (c) => Object.keys(c.s.marks).length > 0 },
  { id: "go-deeper", name: "We Need to Go Deeper", desc: "Reach the middle of the semester", check: (c) => !!c.s.semester && c.today >= midpoint(c.s.semester.start, c.s.semester.end) },
  { id: "the-end-q", name: "The End?", desc: "Classes are over. Finals begin", check: (c) => c.ended },
  { id: "the-end", name: "The End.", desc: "Finish your last paper", check: (c) => c.s.examsDone.length >= 1 },
  { id: "results-in", name: "Results Are In", desc: "Import the result slip for a semester you tracked", check: (c) => c.results.some((r) => c.s.examsDone.includes(r.label) || r.label === c.s.semester?.label) },
  { id: "the-end-again", name: "The End... Again...", desc: "Finish a second semester", check: (c) => c.s.examsDone.length >= 2 },
  { id: "next-generation", name: "The Next Generation", desc: "Graduate", check: (c) => !!c.s.graduated },
  // Attendance
  { id: "full-house", name: "Full House", desc: "Attend every class of a course for a whole semester", check: (c) => c.ended && c.active.some((x) => perfect(c, x)) },
  { id: "perfect-record", name: "Perfect Record", desc: "Attend every class of every course for a whole semester", check: (c) => c.ended && c.active.length > 0 && c.active.every((x) => perfect(c, x)) },
  { id: "serious-dedication", name: "Serious Dedication", desc: "Attend 100 classes", check: (c) => Object.values(c.s.marks).filter((m) => m === "attended").length >= 100 },
  {
    id: "adventuring-time", name: "Adventuring Time", desc: "Attend classes in 10 different venues",
    check: (c) => {
      const venue = new Map(c.s.slots.map((x) => [x.id, x.venue]));
      const seen = new Set(Object.entries(c.s.marks).filter(([, m]) => m === "attended").map(([id]) => venue.get(id.split("@")[0])).filter(Boolean));
      return seen.size >= 10;
    },
  },
  { id: "sweet-dreams", name: "Sweet Dreams", desc: "Miss a class that starts before 9am", check: (c) => c.sessions.some((x) => x.status === "missed" && hhmm(x.start) < "09:00") },
  { id: "not-today", name: "Not Today, Thank You", desc: "One absence from the limit, and you held on to the end", check: (c) => c.ended && c.active.some((x) => missed(c, x) === x.absenceLimit - 1) },
  // Tasks
  { id: "checked-off", name: "Checked Off", desc: "Complete your first task", check: (c) => c.s.tasks.some((t) => t.done) },
  { id: "ten-down", name: "Ten Down", desc: "Finish 10 tasks on time", check: (c) => c.s.tasks.filter(onTime).length >= 10 },
  { id: "ahead-of-the-curve", name: "Ahead of the Curve", desc: "Finish a task a week before it's due", check: (c) => done(c).some((t) => early(t) >= 7 * DAY) },
  { id: "photo-finish", name: "Photo Finish", desc: "Finish a task in its last hour", check: (c) => done(c).some((t) => early(t) >= 0 && early(t) < HOUR) },
  { id: "monster-hunter", name: "Monster Hunter", desc: "Finish a Final assignment", check: (c) => c.s.tasks.some((t) => t.final && t.done) },
  {
    id: "monsters-hunted", name: "Monsters Hunted", desc: "Finish every course's Final on time in one semester",
    check: (c) => {
      const sem = c.s.semester;
      return !!sem && c.active.length > 0 && c.active.every((x) => c.s.tasks.some((t) => t.final && t.courseId === x.id && onTime(t) && ymd(new Date(t.due)) >= sem.start));
    },
  },
  // Grades and rank
  { id: "placement-match", name: "Placement Match", desc: "Get your first semester ranked", check: (c) => c.results.length > 0 },
  { id: "level-up", name: "Level Up", desc: "Rank higher than the semester before", check: (c) => c.results.some((r, i) => i > 0 && TIER_INDEX(rGpa(r).gpa) < TIER_INDEX(rGpa(c.results[i - 1]).gpa)) },
  { id: "overpowered", name: "Overpowered", desc: "Make the Dean's List", check: (c) => c.results.some((r) => rGpa(r).gpa >= 3.5 && rGpa(r).credits >= 12 && !r.courses.some(isFail)) },
  { id: "flawless", name: "Flawless", desc: "A 4.00 semester", check: (c) => c.results.some((r) => rGpa(r).credits > 0 && rGpa(r).gpa === 4) },
  {
    id: "top-of-the-class", name: "Top of the Class", desc: "Reach S tier",
    check: (c) => {
      const d = degree(c.results);
      return c.results.some((r) => rGpa(r).credits > 0 && tierOf(rGpa(r).gpa).tier === "S") || (!!d?.ok && tierOf(d.cgpa).tier === "S");
    },
  },
  { id: "how-did-we-get-here", name: "How Did We Get Here?", desc: "Take 23 or more credit hours in a semester", check: (c) => maxCredits(c) >= 23 },
  { id: "redemption-arc", name: "Redemption Arc", desc: "Pass a course you failed before", check: (c) => [...attempts(c).values()].some((ps) => ps.some((p, i) => p < 2 && ps.slice(i + 1).some((q) => q >= 2))) },
  { id: "those-were-the-days", name: "Those Were the Days", desc: "Import a slip from an earlier semester", check: (c) => !!c.s.semester && c.results.some((r) => labelKey(r.label) < labelKey(c.s.semester!.label)) },
  // Secret
  { id: "voluntary-exile", name: "Voluntary Exile", desc: "Get barred", secret: true, check: (c) => c.active.some((x) => missed(c, x) >= x.absenceLimit) || anyGrade(c, "Y") },
  { id: "deans-blessing", name: "Dean's Blessing", desc: "Take more than 20 credit hours", secret: true, check: (c) => maxCredits(c) > 20 },
  { id: "summer-grind", name: "Summer Grind", desc: "Take a short semester", secret: true, check: (c) => c.results.some((r) => !regular(r)) || !!c.s.semester?.label.startsWith("Sem 3") },
  { id: "tactical-retreat", name: "Tactical Retreat", desc: "Withdraw from a course", secret: true, check: (c) => anyGrade(c, "W") },
  { id: "just-visiting", name: "Just Visiting", desc: "Audit a course", secret: true, check: (c) => anyGrade(c, "AU") },
  { id: "skip-the-tutorial", name: "Skip the Tutorial", desc: "Get a course exempted", secret: true, check: (c) => anyGrade(c, "EX") },
  { id: "to-be-continued", name: "To Be Continued...", desc: "A course that carries on next semester", secret: true, check: (c) => anyGrade(c, "IP") },
  { id: "perfectionist", name: "Perfectionist", desc: "Retake a course you already passed", secret: true, check: (c) => [...attempts(c).values()].some((ps) => ps.some((p, i) => p >= 2 && i < ps.length - 1)) },
  { id: "last-chance-saloon", name: "Last Chance Saloon", desc: "Pass on a resit", secret: true, check: (c) => anyGrade(c, "PR") },
  { id: "objection", name: "Objection!", desc: "A grade changed after rechecking", secret: true, check: (c) => c.results.some((r) => r.regraded) },
  { id: "back-from-the-brink", name: "Back from the Brink", desc: "Climb back above a 2.00 CGPA", secret: true, check: (c) => c.results.some((_, i) => cgpa(c.results.slice(0, i + 1)).cgpa < 2 && c.results.slice(i + 1).some((__, j) => cgpa(c.results.slice(0, i + j + 2)).cgpa >= 2)) },
  { id: "speedrun", name: "Speedrun", desc: "Graduate in four regular semesters", secret: true, check: (c) => !!c.s.graduated && c.results.filter(regular).length === 4 },
  { id: "balanced-diet", name: "A Balanced Diet", desc: "Collect every grade from A to F", secret: true, check: (c) => Object.keys(LETTER_POINTS).every((g) => anyGrade(c, g)) },
  { id: "bare-minimum", name: "Bare Minimum", desc: "A semester GPA of exactly 2.00", secret: true, check: (c) => c.results.some((r) => rGpa(r).credits > 0 && rGpa(r).gpa === 2) },
  {
    id: "copy-paste", name: "Copy Paste", desc: "The same grade in every course", secret: true,
    check: (c) => c.results.some((r) => {
      const gs = r.courses.filter((x) => countedPoint(x) !== null).map((x) => x.grade);
      return gs.length >= 2 && gs.every((g) => g === gs[0]);
    }),
  },
  {
    id: "fasting-scholar", name: "Fasting Scholar", desc: "Attend every class in Ramadan", secret: true,
    check: (c) => {
      const ram = c.sessions.filter((x) => hijriMonth(x.start) === 9);
      return c.ended && ram.length > 0 && ram.every((x) => x.status === "attended");
    },
  },
  { id: "what-am-i-doing", name: "What Am I Doing?", desc: "COND. PASS two semesters in a row", secret: true, check: (c) => condStreak(c) >= 2 },
  { id: "lock-in", name: "You Need to Lock In", desc: "COND. PASS four semesters in a row", secret: true, check: (c) => condStreak(c) >= 4 },
];

function TIER_INDEX(g: number): number {
  return "SABCDF".indexOf(tierOf(g).tier);
}

export const ACHIEVEMENTS: Achievement[] = DEFS.map(({ check: _, ...a }) => a);

export function earned(state: AppState, now: Date): string[] {
  const today = ymd(now);
  const c: Ctx = {
    s: state,
    now,
    today,
    sessions: generateSessions(state, now),
    active: state.courses.filter((x) => x.active),
    results: sortResults(state.results),
    ended: !!state.semester && today > state.semester.end,
  };
  return DEFS.filter((d) => d.check(c)).map((d) => d.id);
}

/** Adds newly earned achievements with the time they were first seen; same object when nothing is new. */
export function recordAchievements(state: AppState, now: Date): AppState {
  const fresh = earned(state, now).filter((id) => !state.achievements[id]);
  if (!fresh.length) return state;
  return { ...state, achievements: { ...state.achievements, ...Object.fromEntries(fresh.map((id) => [id, now.toISOString()])) } };
}
