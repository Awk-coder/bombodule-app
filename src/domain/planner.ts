import type { AppState, Course } from "./types";
import { generateSessions } from "./sessions";
import { addDays, atTime, hhmm, ymd } from "./time";

export interface Planned {
  id: number;
  at: Date;
  kind: "attendance" | "task";
  title: string;
  body: string;
  route: string;
  sessionId?: string;
}

/** FNV-1a → positive 31-bit int, stable across runs so re-scheduling replaces instead of duplicating. */
export function notifId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 1 || 1;
}

export function planNotifications(state: AppState, now: Date, horizonDays = 14): Planned[] {
  const nowMs = now.getTime();
  const horizon = nowMs + horizonDays * 86_400_000;
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const slots = new Map(state.slots.map((s) => [s.id, s]));
  const out: Planned[] = [];

  for (const s of generateSessions(state, now)) {
    if (state.marks[s.id]) continue;
    const at = new Date(s.end.getTime() + state.settings.promptDelayMin * 60_000);
    if (at.getTime() <= nowMs || at.getTime() > horizon) continue;
    const c = courses.get(s.courseId)!;
    const slot = slots.get(s.slotId)!;
    out.push({
      id: notifId(`a:${s.id}`),
      at,
      kind: "attendance",
      sessionId: s.id,
      title: `Did you attend ${c.code}?`,
      body: [c.name, slot.venue].filter(Boolean).join(" · "),
      route: "#/home",
    });
  }

  for (const t of state.tasks) {
    if (t.done) continue;
    const due = new Date(t.due);
    if (due.getTime() <= nowMs) continue;
    const at = atTime(addDays(ymd(due), -1), state.settings.taskReminderTime);
    if (at.getTime() <= nowMs || at.getTime() > horizon) continue;
    const code = t.courseId ? courses.get(t.courseId)?.code : undefined;
    out.push({
      id: notifId(`t:${t.id}`),
      at,
      kind: "task",
      title: `Due tomorrow: ${t.title}`,
      body: [code, `due ${hhmm(due)}`].filter(Boolean).join(" · "),
      route: "#/tasks",
    });
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function warningFor(course: Course, missedBefore: number, missedAfter: number): string | null {
  if (missedAfter <= missedBefore) return null;
  const limit = course.absenceLimit;
  if (missedAfter >= limit && missedBefore < limit) return `${course.code}: ${missedAfter} / ${limit} missed — you've reached the bar limit`;
  if (missedAfter === limit - 1) return `${course.code}: ${missedAfter} / ${limit} missed — one more and you're barred`;
  return null;
}
