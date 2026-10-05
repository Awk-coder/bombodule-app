import type { AppState, PauseInterval, Session } from "./types";
import { addDays, atTime, parseYmd, ymd } from "./time";

export function isPausedOn(pauses: PauseInterval[], date: string): boolean {
  return pauses.some((p) => date >= p.from && (p.to === null || date <= p.to));
}

export function generateSessions(state: AppState, now: Date): Session[] {
  const sem = state.semester;
  if (!sem) return [];
  const active = new Set(state.courses.filter((c) => c.active).map((c) => c.id));
  const slots = state.slots.filter((s) => active.has(s.courseId));
  const out: Session[] = [];
  const today = ymd(now);
  for (let date = sem.start; date <= sem.end; date = addDays(date, 1)) {
    const dow = parseYmd(date).getDay();
    const paused = isPausedOn(state.pauses, date);
    for (const slot of slots) {
      if (slot.day !== dow || (slot.from && date < slot.from) || (slot.until && date > slot.until)) continue;
      const id = `${slot.id}@${date}`;
      const mark = state.marks[id];
      if (paused && !mark) continue;
      const start = atTime(date, slot.start);
      const end = atTime(date, slot.end);
      if (!mark && sem.autoMissFrom && date >= sem.autoMissFrom && date < today) {
        out.push({ id, slotId: slot.id, courseId: slot.courseId, date, start, end, status: "missed", assumed: true });
        continue;
      }
      out.push({ id, slotId: slot.id, courseId: slot.courseId, date, start, end, status: mark ?? (now < end ? "upcoming" : "unmarked") });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
