import type { Day } from "../domain/types";

export interface ParsedCourse {
  code: string;
  name: string;
  section: string;
}

export interface ParsedSlot {
  code: string;
  section: string;
  day: Day;
  start: string;
  end: string;
  venue: string;
  lecturer: string;
}

export interface ParsedSchedule {
  sessionName: string;
  studentName: string | null;
  matric: string | null;
  courses: ParsedCourse[];
  slots: ParsedSlot[];
}

const DAY_CODES: Record<string, Day> = {
  SUN: 0,
  M: 1, MON: 1,
  T: 2, TUE: 2, TUES: 2,
  W: 3, WED: 3,
  TH: 4, THU: 4, THUR: 4, THURS: 4,
  F: 5, FRI: 5,
  SAT: 6,
};

export function parseDays(text: string): Day[] {
  return text
    .toUpperCase()
    .replace(/\s+/g, "")
    .split("-")
    .map((part) => DAY_CODES[part])
    .filter((d): d is Day => d !== undefined);
}

function toHHMM(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 4) return null;
  let h = Number(digits.slice(0, -2));
  const m = Number(digits.slice(-2));
  if (h > 23 || m > 59) return null;
  if (h < 8) h += 12; // i-Ma'luum may write 2:30pm as "230"
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTimeRange(text: string): [string, string] | null {
  const parts = text.split("-");
  if (parts.length !== 2) return null;
  const start = toHHMM(parts[0]);
  const end = toHHMM(parts[1]);
  return start && end ? [start, end] : null;
}

const clean = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

export function parseSchedule(html: string): ParsedSchedule {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const courses = new Map<string, ParsedCourse>();
  const slots: ParsedSlot[] = [];
  let last: ParsedCourse | null = null;

  for (const row of Array.from(doc.querySelectorAll(".box-body table.table.table-hover tr"))) {
    const tds = Array.from(row.querySelectorAll("td"));
    let course: ParsedCourse;
    let cells: string[];
    if (tds.length === 9) {
      course = { code: clean(tds[0]), name: clean(tds[1]), section: clean(tds[2]) };
      courses.set(`${course.code}-${course.section}`, course);
      last = course;
      cells = [tds[5], tds[6], tds[7], tds[8]].map(clean);
    } else if (tds.length === 4 && last) {
      course = last;
      cells = tds.map(clean);
    } else {
      continue;
    }
    const [dayText, timeText, venue, lecturer] = cells;
    const time = parseTimeRange(timeText);
    if (!time) continue;
    for (const day of parseDays(dayText)) {
      slots.push({ code: course.code, section: course.section, day, start: time[0], end: time[1], venue, lecturer });
    }
  }

  const sessionName =
    clean(doc.querySelector(".box-header.with-border .dropdown-toggle") ?? doc.querySelector(".box-header.with-border .box-title")) ||
    "Current semester";
  const profile = clean(doc.querySelector(".user-panel .info") ?? doc.querySelector(".user-header"));
  const studentName = clean(doc.querySelector(".user-panel .info p") ?? doc.querySelector(".user-header p")).replace(/(?<!\d)\d{7}(?!\d)/, "").trim() || null;
  const matric = profile.match(/(?<!\d)\d{7}(?!\d)/)?.[0] ?? null;

  return { sessionName, studentName, matric, courses: [...courses.values()], slots };
}
