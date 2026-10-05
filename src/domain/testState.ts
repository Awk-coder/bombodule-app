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
