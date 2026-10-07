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
