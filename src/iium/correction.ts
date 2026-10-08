export const STANDARD_GRADES = [
  "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "PA", "EX", "W",
] as const;

export const SPECIAL_GRADES = [
  "Y", "FR", "AU", "IP", "P", "PR", "AP", "CO", "FA", "E", "*",
] as const;

export const VALID_GRADES = new Set<string>([...STANDARD_GRADES, ...SPECIAL_GRADES]);

/** Grade to grade-point mapping based on university standards. */
export const GRADE_POINTS: Record<string, number | null> = {
  A: 4.0,
  "A-": 3.67,
  "B+": 3.33,
  B: 3.0,
  "B-": 2.67,
  "C+": 2.33,
  C: 2.0,
  "C-": 1.67,
  "D+": 1.33,
  D: 1.67,
  "D-": 1.33,
  E: 1.0,
  F: 0.0,
  PA: 0.0,
  Y: 0.0,
  FR: 0.0,
  FA: 0.0,
  EX: null,
  W: null,
  AU: null,
  IP: null,
  P: null,
  PR: null,
  AP: null,
  CO: null,
  "*": null,
};

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Fix common OCR confusions in numeric strings (credits, points, GPA). */
export function cleanOcrNumber(raw: string): string {
  let s = raw.trim();
  if (s.startsWith(".")) s = "0" + s;
  // Replace letter confusions only where clearly in a numeric token
  return s
    .replace(/[Oo]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/(?<=\d|\.)[Ss]|[Ss](?=\d|\.)/g, "5")
    .replace(/(?<=\d|\.)[Bb]|[Bb](?=\d|\.)/g, "8");
}

/** Fix common OCR confusions in grade strings. */
export function cleanOcrGrade(raw: string): string {
  let g = raw.trim().toUpperCase().replace(/[—–]/g, "-");
  if (g === "8") return "B";
  if (g === "8+") return "B+";
  if (g === "8-") return "B-";
  if (g === "P4" || g === "P/A") return "PA";
  return g;
}

/** Fix common OCR confusions in course code strings: 3-4 letters + 4 digits. */
export function cleanOcrCourseCode(raw: string): string {
  const norm = raw.trim().replace(/\s+/g, "");
  const m = norm.match(/^([A-Za-z0-9]{3,4})([A-Za-z0-9]{4}[A-Za-z]?)$/);
  if (!m) return raw.trim();
  const letters = m[1].toUpperCase().replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S");
  const digits = m[2].replace(/[Oo]/g, "0").replace(/[LlI|]/g, "1").replace(/[Ss]/g, "5").replace(/[Bb]/g, "8");
  return `${letters} ${digits}`;
}

export interface CourseCheck {
  code: string;
  title: string;
  credits: number;
  grade: string;
  point: number | null;
  qPoint?: number;
}

export interface ValidationSummary {
  ok: boolean;
  warnings: string[];
  correctedCount: number;
}

/**
 * Validates courses against the allowed grade table, verifies that grade points match
 * the standard table (trusting the table if they disagree), checks quality points,
 * and compares recomputed totals with printed values.
 */
export function validateAndCorrectResults(
  courses: CourseCheck[],
  printed?: { gpa?: number; credits?: number; totalPoints?: number },
): ValidationSummary {
  const warnings: string[] = [];
  let correctedCount = 0;

  for (const c of courses) {
    // 1. Grade check
    if (!VALID_GRADES.has(c.grade)) {
      warnings.push(`Course ${c.code} has unrecognized grade "${c.grade}".`);
    }

    // 2. Grade point check against expected standard table
    const expectedPoint = GRADE_POINTS[c.grade];
    if (expectedPoint !== undefined) {
      if (expectedPoint !== null && c.point !== null && Math.abs(c.point - expectedPoint) > 0.02) {
        warnings.push(`Course ${c.code} (${c.grade}) printed point ${c.point.toFixed(2)} disagrees with standard ${expectedPoint.toFixed(2)}. Corrected.`);
        c.point = expectedPoint;
        correctedCount++;
      } else if (expectedPoint !== null && c.point === null) {
        c.point = expectedPoint;
        correctedCount++;
      }
    }

    // 3. Quality point check: credits x grade point (within 0.02)
    if (c.qPoint !== undefined && c.point !== null) {
      const expectedQ = round2(c.credits * c.point);
      if (Math.abs(c.qPoint - expectedQ) > 0.02) {
        warnings.push(`Course ${c.code} quality point mismatch: printed ${c.qPoint.toFixed(2)}, calculated ${expectedQ.toFixed(2)}.`);
      }
    }
  }

  // 4. Totals recomputation
  if (printed) {
    // Courses with numeric grade points count towards credit hours and GPA
    const counted = courses.filter((c) => c.point !== null);
    const computedCredits = round2(courses.reduce((sum, c) => sum + (c.point !== null || c.grade === "PA" ? c.credits : 0), 0));
    const computedPoints = round2(counted.reduce((sum, c) => sum + c.credits * (c.point ?? 0), 0));
    const computedGpa = computedCredits > 0 ? round2(computedPoints / computedCredits) : 0;

    if (printed.credits !== undefined && printed.credits > 0 && Math.abs(computedCredits - printed.credits) > 0.02) {
      warnings.push(`Total credit hours mismatch: courses sum to ${computedCredits}, slip printed ${printed.credits}.`);
    }

    if (printed.totalPoints !== undefined && printed.totalPoints > 0 && Math.abs(computedPoints - printed.totalPoints) > 0.02) {
      warnings.push(`Total quality points mismatch: courses sum to ${computedPoints.toFixed(2)}, slip printed ${printed.totalPoints.toFixed(2)}.`);
    }

    if (printed.gpa !== undefined && Math.abs(computedGpa - printed.gpa) > 0.01) {
      warnings.push(`GPA mismatch: calculated ${computedGpa.toFixed(2)}, slip printed ${printed.gpa.toFixed(2)}.`);
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
    correctedCount,
  };
}
