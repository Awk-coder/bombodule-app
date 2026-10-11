import type { AppState } from "./types";
import { parseYmd, ymd, addDays } from "./time";

function formatIcsDateTime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const [hh, mm] = timeStr.split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function formatIcsUntil(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}${m}${d}T235959`;
}

/** Find first date on or after `startDate` matching given day of week (0=Sun..6=Sat). */
function firstDateForDay(startDate: string, targetDay: number): string {
  let curr = parseYmd(startDate);
  while (curr.getDay() !== targetDay) {
    curr = parseYmd(addDays(ymd(curr), 1));
  }
  return ymd(curr);
}

function escapeIcsText(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateTimetableIcs(state: AppState): string {
  if (!state.semester) return "";
  const courses = new Map(state.courses.filter((c) => c.active).map((c) => [c.id, c]));
  const slots = state.slots.filter((s) => courses.has(s.courseId) && !s.until);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uni Ranked//Timetable Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(state.semester.label ?? "Uni Timetable")}`,
  ];

  const nowStamp = formatIcsDateTime(ymd(new Date()), "00:00");

  for (const slot of slots) {
    const course = courses.get(slot.courseId);
    if (!course) continue;

    const startBoundary = course.startFrom && course.startFrom > state.semester.start ? course.startFrom : state.semester.start;
    const firstDate = firstDateForDay(startBoundary, slot.day);

    const dtStart = formatIcsDateTime(firstDate, slot.start);
    const dtEnd = formatIcsDateTime(firstDate, slot.end);
    const until = formatIcsUntil(state.semester.end);

    const summary = `${course.code} - ${course.name}`;
    const desc = [`Course: ${course.name}`, slot.lecturer ? `Lecturer: ${slot.lecturer}` : "", `Venue: ${slot.venue}`]
      .filter(Boolean)
      .join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${slot.id}-${firstDate}@uniranked`,
      `DTSTAMP:${nowStamp}Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      slot.venue ? `LOCATION:${escapeIcsText(slot.venue)}` : "",
      `DESCRIPTION:${desc}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n") + "\r\n";
}
