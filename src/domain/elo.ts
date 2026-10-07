import { eloFromGpa, gpa, labelKey, sortResults } from "./grades";
import { ymd } from "./time";
import type { AppState, Task } from "./types";

export const DELTA = { onTime: 15, finalOnTime: 45, late: -10, missed: -20, finalMissed: -60 };
const UNRATED = 900;

/** Tasks ticked before completion times were recorded count as on time. */
export const onTime = (t: Task) => t.done && (!t.completedAt || t.completedAt <= t.due);

export interface EloChange {
  taskId: string;
  title: string;
  delta: number;
  at: string; // ISO, when the change happened
}

export interface Season {
  rated: boolean;
  placement: number;
  elo: number;
  changes: EloChange[]; // newest first
}

/** This semester's Elo: placement from the last earlier result slip, moved by tasks due this semester. */
export function seasonElo(state: AppState, now: Date): Season {
  const sem = state.semester;
  const prior = sortResults(state.results).filter((r) => !sem || labelKey(r.label) < labelKey(sem.label));
  const last = prior.at(-1);
  const placement = last ? eloFromGpa(gpa(last.courses).gpa) : UNRATED;
  const changes: EloChange[] = [];
  for (const t of state.tasks) {
    if (sem && ymd(new Date(t.due)) < sem.start) continue;
    let delta = 0;
    if (t.done) delta = onTime(t) ? (t.final ? DELTA.finalOnTime : DELTA.onTime) : DELTA.late;
    else if (new Date(t.due) < now) delta = t.final ? DELTA.finalMissed : DELTA.missed;
    if (delta) changes.push({ taskId: t.id, title: t.title, delta, at: (t.done && t.completedAt) || t.due });
  }
  changes.sort((a, b) => b.at.localeCompare(a.at));
  const elo = Math.max(0, changes.reduce((n, c) => n + c.delta, placement));
  return { rated: !!last, placement, elo, changes };
}
