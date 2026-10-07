import type { Day } from "../domain/types";

export interface ParsedCourse {
  code: string;
  name: string;
  section: string;
  credits: number | null;
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
  sessionName: string | null; // null when the slip has no session/semester line
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

const TIME = String.raw`(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})\s*(AM|PM)`;

const minutes = (h: number, m: number) => h * 60 + m;
const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

/**
 * "11.30 - 12.50 PM" → ["11:30", "12:50"]. The AM/PM belongs to the end time, and the
 * slip prints 12 o'clock under either marker, so 12 is always noon (no class runs past midnight).
 * The start is moved to the afternoon only if that still leaves it before the end.
 */
export function parseTimeRange(text: string): [string, string] | null {
  const m = text.toUpperCase().match(new RegExp(`^\\s*${TIME}\\s*$`));
  if (!m) return null;
  const [sh, sm, eh, em] = m.slice(1, 5).map(Number);
  const pm = m[5] === "PM";
  if (sh > 12 || eh > 12 || sm > 59 || em > 59) return null;
  const end = minutes(eh === 12 || !pm ? eh : eh + 12, em);
  const startPm = minutes(sh + 12, sm);
  const start = pm && sh !== 12 && startPm < end ? startPm : minutes(sh, sm);
  return start < end ? [hhmm(start), hhmm(end)] : null;
}

export interface TextItem {
  str: string;
  x: number;
  y: number; // PDF space: larger is higher on the page
}

/** Turn positioned PDF text into lines of cells, top to bottom, left to right. */
export function groupRows(items: TextItem[], tolerance = 2): string[][] {
  const lines: { y: number; cells: TextItem[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tolerance);
    if (line) line.cells.push(it);
    else lines.push({ y: it.y, cells: [it] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => l.cells.sort((a, b) => a.x - b.x).map((c) => c.str.trim()));
}

const COURSE_ROW = new RegExp(String.raw`^([A-Z]{3,4} ?\d{4}[A-Z]?)\s+(\d+)\s+[A-Z]{1,2}\s+(.+?)\s+(\d+)(?:\s+([A-Z]+(?:\s*-\s*[A-Z]+)*)\s+(${TIME})\s*(.*))?$`);
const SLOT_ROW = new RegExp(String.raw`^(?:\d+\s+)?([A-Z]+(?:\s*-\s*[A-Z]+)*)\s+(${TIME})\s*(.*)$`);

/** Read the "Course Registration Confirmation Slip" from i-Ma'luum, given its text lines. */
export function parseSlip(rows: string[][]): ParsedSchedule {
  const courses: ParsedCourse[] = [];
  const slots: ParsedSlot[] = [];
  let session: string | null = null;
  let semester: string | null = null;
  let studentName: string | null = null;
  let matric: string | null = null;
  let last: ParsedCourse | null = null;

  const addSlots = (course: ParsedCourse, dayText: string, timeText: string, venue: string) => {
    const time = parseTimeRange(timeText);
    if (!time) return;
    for (const day of parseDays(dayText)) {
      slots.push({ code: course.code, section: course.section, day, start: time[0], end: time[1], venue: venue.trim(), lecturer: "" });
    }
  };
  /** Text after `label` in this row, skipping a lone ":" cell. */
  const after = (cells: string[], label: RegExp): string | null => {
    const i = cells.findIndex((c) => label.test(c));
    if (i < 0) return null;
    const inline = cells[i].replace(label, "").replace(/^\s*:\s*/, "").trim();
    if (inline) return inline;
    const next = cells.slice(i + 1).find((c) => c !== ":");
    return next?.replace(/^:\s*/, "").trim() || null;
  };

  for (const cells of rows) {
    const text = cells.join(" ").replace(/\s+/g, " ").trim();
    session ??= text.match(/Session\s*:\s*(\d{4}\/\d{4})/)?.[1] ?? null;
    semester ??= text.match(/Semester\s*:\s*(\d)/)?.[1] ?? null;
    if (/^Matric No\b/.test(text)) matric = after(cells, /^Matric No/)?.match(/\d{7}/)?.[0] ?? null;
    if (/^Name\b/.test(text)) studentName = after(cells, /^Name/);

    const c = text.match(COURSE_ROW);
    if (c) {
      last = { code: c[1].replace(/^([A-Z]+)(\d)/, "$1 $2"), name: c[3], section: c[2], credits: Number(c[4]) };
      courses.push(last);
      if (c[5]) addSlots(last, c[5], c[6], c[12] ?? "");
      continue;
    }
    const s = last && text.match(SLOT_ROW);
    if (s && last) addSlots(last, s[1], s[2], s[8] ?? "");
    else last = null; // anything else ends the course above
  }

  const sessionName = session && semester ? `Sem ${semester}, ${session}` : null;
  return { sessionName, studentName, matric, courses, slots };
}
