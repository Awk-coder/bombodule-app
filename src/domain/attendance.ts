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
