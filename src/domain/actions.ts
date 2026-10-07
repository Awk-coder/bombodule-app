import { DEFAULT_LIMIT, DEFAULT_SETTINGS, PALETTE_SIZE, SEMESTER_DAYS, emptyState } from "./types";
import type { AppState, Course, Mark, Settings, Slot, Task } from "./types";
import { IIUM_CALENDAR } from "./calendar";
import { addDays } from "./time";
import type { ParsedSchedule } from "../iium/parser";
import type { ParsedResult } from "../iium/results";

export const courseKey = (code: string, section: string) => `${code}-${section}`;

export function markSession(state: AppState, sessionId: string, mark: Mark): AppState {
  return { ...state, marks: { ...state.marks, [sessionId]: mark } };
}

/** The section's classes actually began on `date`; null goes back to the scheduled start. */
export function setCourseStart(state: AppState, courseId: string, date: string | null): AppState {
  return {
    ...state,
    courses: state.courses.map((c) => {
      if (c.id !== courseId) return c;
      const { startFrom: _, ...rest } = c;
      return date ? { ...rest, startFrom: date } : rest;
    }),
  };
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

export function toggleTask(state: AppState, id: string, now = new Date()): AppState {
  return {
    ...state,
    tasks: state.tasks.map((t) => {
      if (t.id !== id) return t;
      const { completedAt: _, ...rest } = t;
      return t.done ? { ...rest, done: false } : { ...rest, done: true, completedAt: now.toISOString() };
    }),
  };
}

export function updateSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function setSemesterEnd(state: AppState, end: string): AppState {
  return state.semester ? { ...state, semester: { ...state.semester, end } } : state;
}

export const completeOnboarding = (state: AppState): AppState => ({ ...state, onboarded: true });

/** True when a sync would carry a different semester label while the current semester is still running. */
export function semesterLabelDiffers(state: AppState, parsed: ParsedSchedule, today: string): boolean {
  const sem = state.semester;
  return !!sem && !!parsed.sessionName && parsed.sessionName !== sem.label && today <= sem.end;
}

/** A new semester starts only on first sync, when the old one has ended under a new label, or when asked. */
export function applySync(state: AppState, parsed: ParsedSchedule, today: string, startNewSemester = false): AppState {
  const sem = state.semester;
  const sameSemester = !!sem && !startNewSemester && (!parsed.sessionName || parsed.sessionName === sem.label || today <= sem.end);
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
      ...(sameSemester && prev?.startFrom && { startFrom: prev.startFrom }),
    };
  });
  const syncedIds = new Set(synced.map((c) => c.id));
  const dropped = state.courses.filter((c) => !syncedIds.has(c.id)).map((c) => ({ ...c, active: false }));

  const old = new Map(sameSemester ? state.slots.map((s) => [s.id, s]) : []);
  const slots = new Map<string, Slot>();
  for (const s of parsed.slots) {
    const courseId = courseKey(s.code, s.section);
    const id = `${courseId}-${s.day}-${s.start}`;
    const prev = old.get(id);
    const from = prev ? prev.from : sameSemester ? today : undefined;
    slots.set(id, { id, courseId, day: s.day, start: s.start, end: s.end, venue: s.venue, lecturer: s.lecturer, ...(from && { from }) });
  }
  // Slots that moved or vanished mid-semester stay as history so past marks keep counting.
  const yesterday = addDays(today, -1);
  const retired = [...old.values()]
    .filter((s) => !slots.has(s.id))
    .map((s) => ({ ...s, until: s.until && s.until < yesterday ? s.until : yesterday }));

  return {
    ...state,
    courses: [...synced, ...dropped],
    slots: [...slots.values(), ...retired],
    ...(sameSemester ? { semester: sem } : newSemester(state, parsed.sessionName ?? "Current semester", today)),
    account: {
      name: parsed.studentName ?? state.account?.name ?? null,
      matric: parsed.matric ?? state.account?.matric ?? null,
      lastSync: today,
    },
  };
}

/**
 * Official dates and mid-semester break when IIUM's calendar has this semester; otherwise start today.
 * Every unanswered class in the semester counts as missed once its day is over, including ones before the import.
 */
function newSemester(state: AppState, label: string, today: string): Pick<AppState, "semester" | "pauses"> {
  const cal = IIUM_CALENDAR[label];
  if (!cal) return { semester: { label, start: today, end: addDays(today, SEMESTER_DAYS), autoMissFrom: today }, pauses: state.pauses };
  return { semester: { label, start: cal.start, end: cal.end, autoMissFrom: cal.start }, pauses: [...state.pauses, ...cal.breaks] };
}

/** Save a semester's result slip; re-importing replaces it and notes whether any grade changed. */
export function importResult(state: AppState, parsed: ParsedResult, now: Date): AppState {
  const prev = state.results.find((r) => r.label === parsed.label);
  const grade = (code: string) => prev?.courses.find((c) => c.code === code)?.grade;
  const regraded = !!prev && (prev.regraded || parsed.courses.some((c) => grade(c.code) !== undefined && grade(c.code) !== c.grade));
  const next = { ...parsed, importedAt: now.toISOString(), ...(regraded && { regraded: true as const }) };
  return { ...state, results: [...state.results.filter((r) => r.label !== parsed.label), next] };
}

export function finishExams(state: AppState, label: string): AppState {
  return state.examsDone.includes(label) ? state : { ...state, examsDone: [...state.examsDone, label] };
}

export function setGraduated(state: AppState, now: Date): AppState {
  return { ...state, graduated: now.toISOString() };
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
    results: Array.isArray(obj.results) ? obj.results : [],
    examsDone: Array.isArray(obj.examsDone) ? obj.examsDone : [],
    achievements: typeof obj.achievements === "object" && obj.achievements !== null ? obj.achievements : {},
  } as AppState;
}
