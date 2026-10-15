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
  startFrom?: string; // YYYY-MM-DD, set when the section's classes actually began later than scheduled
  credits?: number; // credit hours, from the confirmation slip's Chr column
}

export interface Slot {
  id: string; // `${courseId}-${day}-${start}`
  courseId: string;
  day: Day;
  start: string; // "HH:MM"
  end: string;
  venue: string;
  lecturer: string;
  from?: string; // YYYY-MM-DD, first date this slot applies (added by a mid-semester re-sync)
  until?: string; // YYYY-MM-DD, last date — set when a re-sync moved or removed the slot
}

export interface Task {
  id: string;
  courseId: string | null;
  title: string;
  due: string; // ISO datetime
  note: string;
  done: boolean;
  completedAt?: string; // ISO, set when ticked done
  final?: boolean; // the course's final assignment
  createdAt?: string; // ISO, set when created
  bullshit?: boolean; // flagged as non-academic / exploit task
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
  theme: string; // ThemeId from ui/themes
  exemptedCredits?: number; // 0..3 credit hours exempted from degree calculation
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
  autoMissFrom?: string; // classes from this date not answered by the end of their day count as missed
}

export interface ResultCourse {
  code: string;
  title: string;
  credits: number;
  grade: string; // letter grade or a code like W, EX, Y
  point: number | null; // as printed; null when the slip shows none
}

export interface SemesterResult {
  label: string; // "Sem 2, 2025/2026"
  courses: ResultCourse[];
  printed: { gpa: number; cgpa: number; credits: number; cumCredits: number; cumPoints: number };
  status: string; // e.g. "COND. PASS"
  remarks: string;
  importedAt: string; // ISO
  regraded?: true; // a re-import changed a grade
}

/** Online leaderboard identity; `key` is the secret the server knows only as a hash. */
export interface Profile {
  id: string;
  key: string;
  name: string;
  group?: string; // friends group invite code
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  tourCompleted?: boolean;
  account: Account | null;
  semester: Semester | null;
  courses: Course[];
  slots: Slot[];
  marks: Record<string, Mark>; // sessionId → mark
  tasks: Task[];
  pauses: PauseInterval[];
  settings: Settings;
  results: SemesterResult[];
  examsDone: string[]; // semester labels where "Finished my last paper" was tapped
  graduated?: string; // ISO, set by "I've graduated"
  achievements: Record<string, string>; // id → unlocked ISO time
  rankPeaks: Record<string, "netherite" | "diamond" | "emerald" | "gold" | "iron" | "coal">; // semester label → highest season rank reached
  profile?: Profile;
  title?: string; // chosen title id from domain/titles
}

export interface Session {
  id: string; // `${slotId}@${date}`
  slotId: string;
  courseId: string;
  date: string;
  start: Date;
  end: Date;
  status: SessionStatus;
  assumed?: true; // missed because it was never answered, not because the user said so
}

export const DEFAULT_LIMIT = 6;
export const SEMESTER_DAYS = 98; // 14 weeks
export const PALETTE_SIZE = 8;

export const DEFAULT_SETTINGS: Settings = {
  promptDelayMin: 0,
  taskReminderTime: "20:00",
  warningsEnabled: true,
  theme: "dark",
  exemptedCredits: 0,
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
    results: [],
    examsDone: [],
    achievements: {},
    rankPeaks: {},
  };
}
