import type { AppState, Course } from "./types";
import { courseStats } from "./attendance";
import { generateSessions } from "./sessions";
import { addDays, atTime, hhmm, ymd } from "./time";

/** What a class prompt's custom notification card shows. */
export interface PromptCard {
  code: string;
  name: string;
  venue: string;
  start: string; // "HH:MM"
  end: string;
  missed: number;
  limit: number;
  color: number; // course palette index
  autoMiss: boolean; // no answer by midnight counts as missed
}

export interface Planned {
  id: number;
  at: Date;
  kind: "attendance" | "task" | "warning" | "nudge";
  title: string;
  body: string;
  route: string;
  sessionId?: string; // attendance: the class asked about; warning: the class whose silence it warns about
  card?: PromptCard;
  pending?: { sessionId: string; code: string }[]; // nudge: the day's classes still unmarked when planned
}

const NUDGE_AFTER_MIN = 120; // after the day's last class

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
  const sessions = generateSessions(state, now);
  const autoMissFrom = state.semester?.autoMissFrom;

  for (const s of sessions) {
    if (state.marks[s.id]) continue;
    const at = new Date(s.start.getTime() + state.settings.promptDelayMin * 60_000);
    if (at.getTime() <= nowMs || at.getTime() > horizon) continue;
    const c = courses.get(s.courseId)!;
    const slot = slots.get(s.slotId)!;
    const autoMiss = !!autoMissFrom && s.date >= autoMissFrom;
    out.push({
      id: notifId(`a:${s.id}`),
      at,
      kind: "attendance",
      sessionId: s.id,
      title: `Did you attend ${c.code}?`,
      body: [c.name, slot.venue, autoMiss && "no answer by midnight = missed"].filter(Boolean).join(" · "),
      route: "#/home",
      card: {
        code: c.code, name: c.name, venue: slot.venue, start: slot.start, end: slot.end,
        missed: courseStats(c, sessions).missed, limit: c.absenceLimit, color: c.color, autoMiss,
      },
    });
  }

  // A day's leftover classes: one reminder after its last class, listing those still unmarked.
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  for (const [date, day] of byDay) {
    const at = new Date(Math.max(...day.map((s) => s.end.getTime())) + NUDGE_AFTER_MIN * 60_000);
    const open = day.filter((s) => !state.marks[s.id]).sort((a, b) => a.start.getTime() - b.start.getTime());
    if (!open.length || at.getTime() <= nowMs || at.getTime() > horizon) continue;
    const pending = open.map((s) => ({ sessionId: s.id, code: courses.get(s.courseId)!.code }));
    out.push({
      id: notifId(`n:${date}`),
      at,
      kind: "nudge",
      title: "Mark today's classes",
      body: `${pending.length} unmarked: ${pending.map((p) => p.code).join(", ")}`,
      route: "#/home",
      pending,
    });
  }

  // An unanswered class becomes a miss at midnight; warn then if that miss is the one that matters.
  if (autoMissFrom && state.settings.warningsEnabled) {
    const today = ymd(now);
    for (const c of state.courses) {
      if (!c.active) continue;
      const next = sessions.find((s) => s.courseId === c.id && s.date >= today && s.date >= autoMissFrom && (s.status === "upcoming" || s.status === "unmarked"));
      if (!next) continue;
      const missed = courseStats(c, sessions).missed + 1;
      const tail = missed >= c.absenceLimit ? "you've reached the bar limit" : missed === c.absenceLimit - 1 ? "one more and you're barred" : null;
      const at = atTime(addDays(next.date, 1), "00:00");
      if (!tail || at.getTime() <= nowMs || at.getTime() > horizon) continue;
      out.push({
        id: notifId(`w:${next.id}`),
        at,
        kind: "warning",
        sessionId: next.id,
        title: "Absence warning",
        body: `${c.code}: not answered, counted as missed — ${missed} / ${c.absenceLimit}, ${tail}`,
        route: `#/course/${encodeURIComponent(c.id)}`,
      });
    }
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
