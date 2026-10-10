import type { Semester } from "./types";
import { addDays, ymd } from "./time";

/**
 * IIUM academic calendar (Gombak, Kuantan & Pagoh; all kulliyyahs except Medicine and Dentistry),
 * from the 527th Senate Meeting calendar for 2026/2027. Keyed by the label the slip parser builds.
 * Add the next session here when IIUM publishes it; unknown semesters fall back to a 14-week guess.
 */
export interface CalendarSemester {
  start: string; // first lecture day
  end: string; // last lecture day
  breaks: { from: string; to: string }[];
}

export const IIUM_CALENDAR: Record<string, CalendarSemester> = {
  "Sem 1, 2026/2027": { start: "2026-09-28", end: "2027-01-08", breaks: [{ from: "2026-11-14", to: "2026-11-22" }] },
  "Sem 2, 2026/2027": { start: "2027-02-22", end: "2027-06-04", breaks: [{ from: "2027-04-10", to: "2027-04-18" }] },
  "Sem 3, 2026/2027": { start: "2027-07-19", end: "2027-09-03", breaks: [] },
};

/**
 * Returns the current lecture/academic week of the semester (1-based).
 * Accounts for mid-semester breaks from IIUM_CALENDAR.
 * Returns 0 if before semester start, or >14 if after semester end.
 */
export function getSemesterWeek(sem: Semester | null | undefined, now: Date): number {
  if (!sem) return 12; // no semester active, treat as unlocked
  const today = ymd(now);
  if (today < sem.start) return 0;
  if (today > sem.end) return 99; // exam period or finished

  const cal = IIUM_CALENDAR[sem.label];
  let days = 0;
  let cur = sem.start;
  while (cur <= today && cur <= sem.end) {
    const inBreak = cal?.breaks.some((b) => cur >= b.from && cur <= b.to);
    if (!inBreak) {
      days++;
    }
    cur = addDays(cur, 1);
  }
  return Math.max(1, Math.ceil(days / 7));
}

/**
 * Returns total academic weeks in the semester.
 */
export function getSemesterTotalWeeks(sem: Semester | null | undefined): number {
  if (!sem) return 14;
  const cal = IIUM_CALENDAR[sem.label];
  let days = 0;
  let cur = sem.start;
  while (cur <= sem.end) {
    const inBreak = cal?.breaks.some((b) => cur >= b.from && cur <= b.to);
    if (!inBreak) {
      days++;
    }
    cur = addDays(cur, 1);
  }
  return Math.max(1, Math.ceil(days / 7));
}

/**
 * Final exam / assignment tasks are hidden in the Tasks view until the 12th week of the semester
 * (or week (totalWeeks - 2) in shorter semesters like Sem 3).
 */
export function isFinalExamTaskVisible(sem: Semester | null | undefined, now: Date): boolean {
  if (!sem) return true;
  const currentWeek = getSemesterWeek(sem, now);
  const totalWeeks = getSemesterTotalWeeks(sem);
  const unlockWeek = totalWeeks >= 12 ? 12 : Math.max(1, totalWeeks - 2);
  return currentWeek >= unlockWeek;
}
