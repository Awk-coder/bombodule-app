import { eloFromGpa, gpa, labelKey, round2, sortResults } from "./grades";
import { ymd } from "./time";
import type { AppState, SemesterResult, Task } from "./types";

export const DELTA = { onTime: 6, finalOnTime: 18, late: -4, missed: -12, finalMissed: -30 };
const UNRATED = 900;
export const MAX_TASKS_PER_WEEK = 5;

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

/** Monday of the week for given date. */
export function weekKey(d: Date): string {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diff);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Underdog comeback multiplier on task Elo gains: 1.35x when GPA jumped by >= 1.0. */
export function comebackMultiplier(prior: SemesterResult[]): number {
  const last = prior.at(-1);
  const prev = prior.at(-2);
  if (!last || !prev || last.label.startsWith("Sem 3")) return 1.0;
  const delta = round2(gpa(last.courses).gpa - gpa(prev.courses).gpa);
  return delta >= 1.0 ? 1.35 : 1.0;
}

/**
 * Computes season placement Elo from prior result slips:
 * - Short semesters (Sem 3) are always considered less and hard-capped at Diamond III (1999).
 * - Regular semesters receive credit load bonuses (+40 to +120).
 * - Underdogs with a massive comeback (>= +1.0 GPA jump) gain a +100 Elo bonus (+50 for >= +0.5).
 */
export function placementElo(prior: SemesterResult[]): number {
  const last = prior.at(-1);
  if (!last) return UNRATED;
  const isShort = last.label.startsWith("Sem 3");
  const lastGpa = gpa(last.courses).gpa;
  const base = eloFromGpa(lastGpa);

  // Short semesters are always capped at Diamond III (max 1999)
  if (isShort) {
    return Math.min(1999, base);
  }

  // Credit load bonus
  const credits = last.courses.reduce((sum, c) => sum + c.credits, 0);
  let loadBonus = 0;
  if (credits >= 20) loadBonus = 120;
  else if (credits >= 15) loadBonus = 80;
  else if (credits >= 9) loadBonus = 40;

  // Underdog Comeback bonus
  let comebackBonus = 0;
  const prev = prior.at(-2);
  if (prev) {
    const prevGpa = gpa(prev.courses).gpa;
    const delta = round2(lastGpa - prevGpa);
    if (delta >= 1.0) comebackBonus = 100;
    else if (delta >= 0.5) comebackBonus = 50;
  }

  return base + loadBonus + comebackBonus;
}

/**
 * Task Elo gain with diminishing returns at high tiers:
 * - Below Netherite (<2000): +6 normal, +18 final
 * - In Netherite (2000-2299): +4 normal, +12 final
 * - Peak tier (2300+): +2 normal, +6 final (super slow progress)
 */
export function taskGain(currentElo: number, final: boolean, mult = 1.0): number {
  let base: number;
  if (currentElo >= 2300) {
    base = final ? 6 : 2;
  } else if (currentElo >= 2000) {
    base = final ? 12 : 4;
  } else {
    base = final ? DELTA.finalOnTime : DELTA.onTime;
  }
  return mult > 1.0 ? Math.round(base * mult) : base;
}

/** This semester's Elo: placement from earlier result slips, moved by tasks due this semester. */
export function seasonElo(state: AppState, now: Date): Season {
  const sem = state.semester;
  const isShortSem = !!sem && sem.label.startsWith("Sem 3");
  const prior = sortResults(state.results).filter((r) => !sem || labelKey(r.label) < labelKey(sem.label));
  const last = prior.at(-1);
  const placement = last ? placementElo(prior) : UNRATED;
  const mult = comebackMultiplier(prior);

  // Group tasks by week and enforce max positive tasks per week
  const relevantTasks = state.tasks.filter((t) => !sem || ymd(new Date(t.due)) >= sem.start);
  const sortedTasks = [...relevantTasks].sort((a, b) => {
    const timeA = a.done && a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.due).getTime();
    const timeB = b.done && b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.due).getTime();
    return timeA - timeB;
  });

  const weeklyPositiveCount: Record<string, number> = {};
  const changes: EloChange[] = [];
  let runningElo = placement;

  for (const t of sortedTasks) {
    const dueTime = new Date(t.due);
    const wKey = weekKey(dueTime);
    let delta = 0;

    if (t.done) {
      if (onTime(t)) {
        const count = weeklyPositiveCount[wKey] ?? 0;
        if (count < MAX_TASKS_PER_WEEK) {
          weeklyPositiveCount[wKey] = count + 1;
          delta = taskGain(runningElo, !!t.final, mult);
        } else {
          delta = 0; // weekly cap reached
        }
      } else {
        delta = DELTA.late;
      }
    } else if (dueTime < now) {
      delta = t.final ? DELTA.finalMissed : DELTA.missed;
    }

    if (delta !== 0 || (t.done && onTime(t))) {
      changes.push({
        taskId: t.id,
        title: t.title + (t.done && onTime(t) && delta === 0 ? " (weekly cap)" : ""),
        delta,
        at: (t.done && t.completedAt) || t.due,
      });
      runningElo = Math.max(0, runningElo + delta);
      if (isShortSem) runningElo = Math.min(1999, runningElo);
    }
  }

  changes.sort((a, b) => b.at.localeCompare(a.at));
  const elo = isShortSem ? Math.min(1999, runningElo) : runningElo;

  return { rated: !!last, placement, elo, changes };
}
