import type { ResultCourse, SemesterResult } from "./types";

export type Tier = "S" | "A" | "B" | "C" | "D" | "F";
export type Ore = "netherite" | "diamond" | "emerald" | "gold" | "iron" | "coal";

export const TIERS: { tier: Tier; ore: Ore; minGpa: number }[] = [
  { tier: "S", ore: "netherite", minGpa: 3.67 },
  { tier: "A", ore: "diamond", minGpa: 3.5 },
  { tier: "B", ore: "emerald", minGpa: 3 },
  { tier: "C", ore: "gold", minGpa: 2.5 },
  { tier: "D", ore: "iron", minGpa: 2 },
  { tier: "F", ore: "coal", minGpa: 0 },
];

export const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
export const tierOf = (g: number) => TIERS.find((t) => round2(g) >= t.minGpa)!;

export const LETTER_POINTS: Record<string, number> = { A: 4, "A-": 3.67, "B+": 3.33, B: 3, "B-": 2.67, "C+": 2.33, C: 2, D: 1.67, "D-": 1.33, E: 1, F: 0 };
const ZERO = new Set(["Y", "FR"]); // barred and fail-on-resit count as F
const UNCOUNTED = new Set(["P", "PA", "W", "AU", "EX", "IP", "I", "AP", "CO", "PR", "FA", "*"]);

/** Grade point that counts toward GPA, or null when this grade doesn't count. */
export function countedPoint(c: ResultCourse): number | null {
  if (ZERO.has(c.grade)) return 0;
  return LETTER_POINTS[c.grade] ?? null;
}

export const isFail = (c: ResultCourse) => {
  const p = countedPoint(c);
  return p !== null && p < 2;
};

export function gpa(courses: ResultCourse[]): { gpa: number; credits: number; points: number } {
  let credits = 0;
  let points = 0;
  for (const c of courses) {
    const p = countedPoint(c);
    if (p === null) continue;
    credits += c.credits;
    points += c.credits * p;
  }
  return { gpa: credits ? round2(points / credits) : 0, credits: round2(credits), points: round2(points) };
}

/** "Sem 2, 2025/2026" → "2025-2", which sorts chronologically. */
export function labelKey(label: string): string {
  const m = label.match(/Sem (\d), (\d{4})\/\d{4}/);
  return m ? `${m[2]}-${m[1]}` : label;
}

export const sortResults = (results: SemesterResult[]) => [...results].sort((a, b) => labelKey(a.label).localeCompare(labelKey(b.label)));

/** IIUM §15–16: a passed retake replaces a fail; retaking a passed course keeps the better grade. */
export function cgpa(results: SemesterResult[]): { cgpa: number; credits: number; points: number } {
  const attempts = new Map<string, ResultCourse[]>();
  for (const r of sortResults(results)) {
    for (const c of r.courses) {
      if (countedPoint(c) === null) continue;
      attempts.set(c.code, [...(attempts.get(c.code) ?? []), c]);
    }
  }
  const kept = [...attempts.values()].map((list) => {
    const passed = list.filter((c) => !isFail(c));
    return passed.length ? passed.reduce((a, b) => (countedPoint(b)! > countedPoint(a)! ? b : a)) : list[list.length - 1];
  });
  const g = gpa(kept);
  return { cgpa: g.gpa, credits: g.credits, points: g.points };
}

export function unknownGrades(results: SemesterResult[]): string[] {
  const out = new Set<string>();
  for (const r of results) for (const c of r.courses) if (countedPoint(c) === null && !UNCOUNTED.has(c.grade)) out.add(c.grade);
  return [...out];
}

export interface Degree {
  cgpa: number;
  credits: number;
  ok: boolean;
  reason: string | null;
}

/** The app's own CGPA; `ok` only when it reproduces the latest slip, i.e. every past slip is imported. */
export function degree(results: SemesterResult[]): Degree | null {
  if (!results.length) return null;
  const latest = sortResults(results).at(-1)!;
  const c = cgpa(results);
  const unknown = unknownGrades(results);
  let reason: string | null = null;
  if (unknown.length) reason = `Unknown grade codes: ${unknown.join(", ")}`;
  else if (c.credits !== latest.printed.cumCredits) reason = `Found ${c.credits} of ${latest.printed.cumCredits} credit hours. Import your earlier result slips.`;
  else if (c.cgpa !== latest.printed.cgpa) reason = `Calculated CGPA ${c.cgpa.toFixed(2)}, slip says ${latest.printed.cgpa.toFixed(2)}.`;
  return { cgpa: c.cgpa, credits: c.credits, ok: !reason, reason };
}

export function semesterMismatch(r: SemesterResult): string | null {
  const g = gpa(r.courses).gpa;
  return g === r.printed.gpa ? null : `Calculated GPA ${g.toFixed(2)}, slip says ${r.printed.gpa.toFixed(2)}.`;
}

const GPA_PTS = [0, 2, 2.5, 3, 3.5, 3.67, 4];
const ELO_PTS = [0, 600, 900, 1200, 1500, 2000, 2300];

export function eloFromGpa(g: number): number {
  const x = Math.min(4, Math.max(0, round2(g)));
  for (let i = 1; i < GPA_PTS.length; i++) {
    if (x <= GPA_PTS[i]) return Math.round(ELO_PTS[i - 1] + ((x - GPA_PTS[i - 1]) / (GPA_PTS[i] - GPA_PTS[i - 1])) * (ELO_PTS[i] - ELO_PTS[i - 1]));
  }
  return ELO_PTS[ELO_PTS.length - 1];
}

export const DIVISIONS: { ore: Ore; div: 1 | 2 | 3 | null; min: number }[] = [
  { ore: "coal", div: 1, min: 0 }, { ore: "coal", div: 2, min: 400 }, { ore: "coal", div: 3, min: 500 },
  { ore: "iron", div: 1, min: 600 }, { ore: "iron", div: 2, min: 700 }, { ore: "iron", div: 3, min: 800 },
  { ore: "gold", div: 1, min: 900 }, { ore: "gold", div: 2, min: 1000 }, { ore: "gold", div: 3, min: 1100 },
  { ore: "emerald", div: 1, min: 1200 }, { ore: "emerald", div: 2, min: 1300 }, { ore: "emerald", div: 3, min: 1400 },
  { ore: "diamond", div: 1, min: 1500 }, { ore: "diamond", div: 2, min: 1650 }, { ore: "diamond", div: 3, min: 1800 },
  { ore: "netherite", div: null, min: 2000 },
];

export interface Rank {
  ore: Ore;
  div: 1 | 2 | 3 | null;
  min: number;
  next: number | null;
  progress: number; // 0..1 toward `next`
}

export function rankOf(elo: number): Rank {
  let i = 0;
  while (i + 1 < DIVISIONS.length && elo >= DIVISIONS[i + 1].min) i++;
  const d = DIVISIONS[i];
  const next = DIVISIONS[i + 1]?.min ?? null;
  return { ...d, next, progress: next === null ? 1 : (elo - d.min) / (next - d.min) };
}
