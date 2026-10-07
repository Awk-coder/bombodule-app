import type { ResultCourse, SemesterResult } from "../domain/types";

export interface ParsedResult {
  label: string;
  courses: ResultCourse[];
  printed: SemesterResult["printed"];
  status: string;
  remarks: string;
}

const COURSE = /^([A-Z]{3,4} ?\d{4}[A-Z]?)\s+(.+?)\s+(\d*\.?\d+)\s+([A-Z]{1,2}[+-]?|\*)(?:\s+(\d*\.\d+))?(?:\s+(\d*\.\d+))?$/;
const FIELDS = ["TOTAL CREDIT POINTS", "CUMULATIVE GRADE POINTS", "TOTAL CREDIT HOURS", "CUMULATIVE CREDIT HOURS", "GRADE POINT AVERAGE(GPA)", "CGPA", "STATUS", "REMARKS"];

/** Read the i-Ma'luum "Examination Result" slip. Only labelled fields are read, so personal lines are never kept. */
export function parseResults(rows: string[][]): ParsedResult | null {
  let label: string | null = null;
  const courses: ResultCourse[] = [];
  const f: Record<string, string> = {};
  for (const cells of rows) {
    const text = cells.join(" ").replace(/\s+/g, " ").trim();
    const s = text.match(/SESSION\s*:\s*(\d{4}\/\d{4})\s+SEMESTER\s*:\s*(\d)/i);
    if (s) {
      label = `Sem ${s[2]}, ${s[1]}`;
      continue;
    }
    const c = text.match(COURSE);
    if (c) {
      courses.push({ code: c[1].replace(/^([A-Z]+)(\d)/, "$1 $2"), title: c[2], credits: Number(c[3]), grade: c[4], point: c[5] ? Number(c[5]) : null });
      continue;
    }
    cells.forEach((cell, i) => {
      const key = cell.trim().toUpperCase().replace("CUMMULATIVE", "CUMULATIVE");
      if (!FIELDS.includes(key)) return;
      const value = cells.slice(i + 1).find((x) => x.trim() !== ":");
      if (value) f[key] = value.replace(/^:\s*/, "").trim();
    });
  }
  const gpa = Number(f["GRADE POINT AVERAGE(GPA)"]);
  const cgpa = Number(f["CGPA"]);
  if (!label || courses.length === 0 || !f["CGPA"] || Number.isNaN(gpa) || Number.isNaN(cgpa)) return null;
  return {
    label,
    courses,
    printed: {
      gpa,
      cgpa,
      credits: Number(f["TOTAL CREDIT HOURS"] ?? 0),
      cumCredits: Number(f["CUMULATIVE CREDIT HOURS"] ?? 0),
      cumPoints: Number(f["CUMULATIVE GRADE POINTS"] ?? 0),
    },
    status: f["STATUS"] ?? "",
    remarks: f["REMARKS"] ?? "",
  };
}
