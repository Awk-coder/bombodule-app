import { eloFromGpa, gpa, labelKey, round2, sortResults } from "./grades";
import { ymd } from "./time";
import type { AppState, SemesterResult, Task } from "./types";

export const DELTA = { onTime: 3, finalOnTime: 18, late: -2, missed: -6, finalMissed: -15 };
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

export interface PlacementBreakdown {
  base: number;
  credits: number;
  loadBonus: number;
  comebackBonus: number;
}

export interface Season {
  rated: boolean;
  placement: number;
  placementBreakdown?: PlacementBreakdown;
  comebackActive: boolean;
  weeklyTaskCount: number;
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

export interface ComebackEvaluation {
  active: boolean;
  bonus: number;
  multiplier: number;
  delta?: number;
}

/**
 * Underdog comeback evaluation:
 * - Student must have had a GPA <= 2.20 in a semester prior to `last`.
 * - In `last`, GPA climbed by >= +0.50 (+50 Elo) or >= +1.00 (+100 Elo and 1.35x velocity).
 * - Strictly ONE-TIME: once redeemed in an earlier semester, it cannot be claimed again.
 */
export function evaluateComeback(prior: SemesterResult[]): ComebackEvaluation {
  const sorted = sortResults(prior);
  if (sorted.length < 2) return { active: false, bonus: 0, multiplier: 1.0 };

  // Check if any earlier semester already claimed the one-time comeback
  for (let i = 1; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    if (cur.label.startsWith("Sem 3")) continue;
    const curGpa = gpa(cur.courses).gpa;
    const prevGpa = gpa(prev.courses).gpa;
    if (prevGpa <= 2.20 && round2(curGpa - prevGpa) >= 0.50) {
      // Already redeemed in an earlier semester! "Once you climb you better stay there."
      return { active: false, bonus: 0, multiplier: 1.0 };
    }
  }

  const last = sorted.at(-1)!;
  const prev = sorted.at(-2)!;
  if (last.label.startsWith("Sem 3")) return { active: false, bonus: 0, multiplier: 1.0 };

  const lastGpa = gpa(last.courses).gpa;
  const prevGpa = gpa(prev.courses).gpa;

  // Previous GPA must be 2.20 or less to qualify as an underdog
  if (prevGpa > 2.20) {
    return { active: false, bonus: 0, multiplier: 1.0 };
  }

  const delta = round2(lastGpa - prevGpa);
  if (delta >= 1.0) {
    return { active: true, bonus: 100, multiplier: 1.35, delta };
  }
  if (delta >= 0.5) {
    return { active: true, bonus: 50, multiplier: 1.0, delta };
  }
  return { active: false, bonus: 0, multiplier: 1.0, delta };
}

/** Underdog comeback multiplier on task Elo gains: 1.35x when GPA jumped by >= 1.0 from <= 2.20. */
export function comebackMultiplier(prior: SemesterResult[]): number {
  return evaluateComeback(prior).multiplier;
}

/** Overload bonus: strictly for heavy overload (> 18 credits), +10 Elo per credit above 18. */
export function creditLoadBonus(credits: number): number {
  return credits > 18 ? Math.round((credits - 18) * 10) : 0;
}

export function placementDetails(prior: SemesterResult[]): { placement: number; breakdown?: PlacementBreakdown } {
  const last = prior.at(-1);
  if (!last) return { placement: UNRATED };
  const isShort = last.label.startsWith("Sem 3");
  const lastGpa = gpa(last.courses).gpa;
  const base = eloFromGpa(lastGpa);
  const credits = last.courses.reduce((sum, c) => sum + c.credits, 0);

  // Short semesters are always capped at Diamond III (max 1999)
  if (isShort) {
    return {
      placement: Math.min(1999, base),
      breakdown: { base, credits, loadBonus: 0, comebackBonus: 0 },
    };
  }

  const loadBonus = creditLoadBonus(credits);
  const comeback = evaluateComeback(prior);

  return {
    placement: base + loadBonus + comeback.bonus,
    breakdown: { base, credits, loadBonus, comebackBonus: comeback.bonus },
  };
}

/**
 * Computes season placement Elo from prior result slips:
 * - Short semesters (Sem 3) are always considered less and hard-capped at Diamond III (1999).
 * - Overload semesters (>18 cr) receive +10 Elo per credit above 18.
 * - Underdogs leaping from <= 2.20 GPA gain a one-time +100 Elo bonus (+50 for >= +0.5).
 */
export function placementElo(prior: SemesterResult[]): number {
  return placementDetails(prior).placement;
}

/**
 * Task Elo gain proportional across rank tiers:
 * - Under Emerald (<1600): +3 normal, +18 final (half of legacy +6/+35)
 * - Emerald (1600-1799): +3 normal, +15 final
 * - Diamond (1800-1999): +2 normal, +10 final
 * - Netherite (2000+): +1 normal, +5 final (peak 2350+: +1 normal, +3 final)
 */
export function taskGain(currentElo: number, final: boolean, mult = 1.0): number {
  let base: number;
  if (currentElo >= 2350) {
    base = final ? 3 : 1;
  } else if (currentElo >= 2000) {
    base = final ? 5 : 1;
  } else if (currentElo >= 1800) {
    base = final ? 10 : 2;
  } else if (currentElo >= 1600) {
    base = final ? 15 : 3;
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
  const { placement, breakdown } = last ? placementDetails(prior) : { placement: UNRATED, breakdown: undefined };
  const comeback = evaluateComeback(prior);
  const mult = comeback.multiplier;

  // Group tasks by week and enforce max positive tasks per week
  const relevantTasks = state.tasks.filter((t) => !sem || ymd(new Date(t.due)) >= sem.start);
  const sortedTasks = [...relevantTasks].sort((a, b) => {
    const timeA = a.done && a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.due).getTime();
    const timeB = b.done && b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.due).getTime();
    return timeA - timeB;
  });

  const currentWeekKey = weekKey(now);
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
  const currentWeekCount = weeklyPositiveCount[currentWeekKey] ?? 0;

  return {
    rated: !!last,
    placement,
    placementBreakdown: breakdown,
    comebackActive: comeback.active && comeback.multiplier > 1.0,
    weeklyTaskCount: currentWeekCount,
    elo,
    changes,
  };
}
