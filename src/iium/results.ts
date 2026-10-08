import type { ResultCourse, SemesterResult } from "../domain/types";
import {
  cleanOcrCourseCode,
  cleanOcrGrade,
  cleanOcrNumber,
  validateAndCorrectResults,
} from "./correction";

export interface ParsedResult {
  label: string;
  courses: ResultCourse[];
  printed: SemesterResult["printed"];
  status: string;
  remarks: string;
  warnings?: string[];
}

const COURSE = /^([A-Za-z0-9]{3,4}\s*[A-Za-z0-9]{4}[A-Za-z]?)\s+(.+?)\s+(\d*\.?\d+)\s+([A-Za-z0-9]{1,2}[+-]?|\*)(?:\s+(\d*\.?\d+))?(?:\s+(\d*\.?\d+))?$/;

/** Read the i-Ma'luum "Examination Result" slip. Only labelled fields are read, so personal lines are never kept. */
export function parseResults(rows: string[][]): ParsedResult | null {
  let label: string | null = null;
  const courses: (ResultCourse & { qPoint?: number })[] = [];
  const f: Record<string, string> = {};

  for (const cells of rows) {
    let text = cells.join(" ").replace(/\s+/g, " ").trim();
    text = text.replace(/ \| /g, " I ");

    const s = text.match(/SESSION\s*[:@©~0O-]?\s*(\d{4}\/\d{4})\s+SEMESTER\s*[:@©~0O-]?\s*(\d)/i);
    if (s) {
      label = `Sem ${s[2]}, ${s[1]}`;
      continue;
    }

    const c = text.match(COURSE);
    if (c) {
      const code = cleanOcrCourseCode(c[1]);
      const credits = Number(cleanOcrNumber(c[3]));
      const grade = cleanOcrGrade(c[4]);
      const point = c[5] ? Number(cleanOcrNumber(c[5])) : null;
      const qPoint = c[6] ? Number(cleanOcrNumber(c[6])) : undefined;
      courses.push({
        code,
        title: c[2].trim(),
        credits,
        grade,
        point,
        qPoint,
      });
      continue;
    }

    const cp = text.match(/TOTAL\s+CREDIT\s+POINTS\s*[:@©~0O-]?\s*([\d.]+)/i);
    if (cp) f["TOTAL CREDIT POINTS"] = cleanOcrNumber(cp[1]);
    const cgp = text.match(/CUMM?ULATIVE\s+GRADE\s+POINTS\s*[:@©~0O-]?\s*([\d.]+)/i);
    if (cgp) f["CUMULATIVE GRADE POINTS"] = cleanOcrNumber(cgp[1]);
    const ch = text.match(/TOTAL\s+CREDIT\s+HOURS\s*[:@©~0O-]?\s*([\d.]+)/i);
    if (ch) f["TOTAL CREDIT HOURS"] = cleanOcrNumber(ch[1]);
    const cch = text.match(/CUMM?ULATIVE\s+CREDIT\s+HOURS\s*[:@©~0O-]?\s*([\d.]+)/i);
    if (cch) f["CUMULATIVE CREDIT HOURS"] = cleanOcrNumber(cch[1]);
    const gpaMatch = text.match(/(?:GRADE\s+POINT\s+AVERAGE\s*\(GPA\)|\bGPA\b)\s*[:@©~0O-]?\s*([\d.]+)/i);
    if (gpaMatch) f["GRADE POINT AVERAGE(GPA)"] = cleanOcrNumber(gpaMatch[1]);
    const cgpaMatch = text.match(/\bCGPA\b\s*[:@©~0O-]?\s*([\d.]+)/i);
    if (cgpaMatch) f["CGPA"] = cleanOcrNumber(cgpaMatch[1]);
    const st = text.match(/\bSTATUS\s*[:@©~0O-]?\s*([A-Za-z. ]+)/i);
    if (st) f["STATUS"] = st[1].trim();
    const rm = text.match(/\bREMARKS\s*[:@©~0O-]?\s*([A-Za-z0-9,._ ]+)/i);
    if (rm) f["REMARKS"] = rm[1].trim();
  }

  const gpa = Number(f["GRADE POINT AVERAGE(GPA)"]);
  const cgpa = Number(f["CGPA"]);
  if (!label || courses.length === 0 || !f["CGPA"] || Number.isNaN(gpa) || Number.isNaN(cgpa)) {
    return null;
  }

  const credits = Number(f["TOTAL CREDIT HOURS"] ?? 0);
  const totalPoints = f["TOTAL CREDIT POINTS"] ? Number(f["TOTAL CREDIT POINTS"]) : undefined;

  const validation = validateAndCorrectResults(courses, {
    gpa,
    credits,
    totalPoints,
  });

  return {
    label,
    courses: courses.map(({ qPoint, ...x }) => x),
    printed: {
      gpa,
      cgpa,
      credits,
      cumCredits: Number(f["CUMULATIVE CREDIT HOURS"] ?? 0),
      cumPoints: Number(f["CUMULATIVE GRADE POINTS"] ?? 0),
    },
    status: f["STATUS"] ?? "",
    remarks: f["REMARKS"] ?? "",
    warnings: validation.warnings,
  };
}
