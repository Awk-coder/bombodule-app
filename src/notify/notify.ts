import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AppState, Mark } from "../domain/types";
import { planNotifications, type Planned } from "../domain/planner";
import { generateSessions } from "../domain/sessions";
import { Hadir, type PromptItem } from "../native/hadir";
import { fmtTime, titleCase } from "../ui/format";

export interface NotificationAction {
  actionId: string;
  sessionId?: string;
  route?: string;
}

export const isMark = (id: string): id is Mark => id === "attended" || id === "missed";

export async function initNotifications(onAction: (a: NotificationAction) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
    const extra = (e.notification.extra ?? {}) as { sessionId?: string; route?: string };
    onAction({ actionId: e.actionId, sessionId: extra.sessionId, route: extra.route });
  });
}

let queue: Promise<void> = Promise.resolve();

/**
 * Cancel everything pending and schedule the next 14 days from scratch.
 * Runs one at a time and reads state just before planning, so a slow run can't
 * re-schedule a prompt for a class marked while it was in flight.
 */
export function reschedule(read: () => AppState, now?: Date): Promise<void> {
  queue = queue.then(() => run(read, now ?? new Date())).catch((e) => console.error("reschedule failed", e));
  return queue;
}

async function run(read: () => AppState, now: Date): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  const planned = planNotifications(read(), now);
  // Class prompts and their warnings get the custom card, drawn and answered natively (Hadir plugin).
  await Hadir.schedulePrompts({ items: planned.filter((p) => p.kind !== "task").map(toPrompt) });
  const tasks = planned.filter((p) => p.kind === "task");
  if (!tasks.length) return;
  await LocalNotifications.schedule({
    notifications: tasks.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      schedule: { at: p.at, allowWhileIdle: true },
      extra: { route: p.route },
    })),
  });
}

function toPrompt(p: Planned): PromptItem {
  const base = { id: p.id, at: p.at.getTime(), kind: p.kind as PromptItem["kind"], sessionId: p.sessionId!, title: p.title, body: p.body, route: p.route };
  const c = p.card;
  if (!c) return base;
  return {
    ...base, code: c.code, name: titleCase(c.name), venue: c.venue, time: `${fmtTime(c.start)} - ${fmtTime(c.end)}`,
    missed: c.missed, limit: c.limit, color: c.color, autoMiss: c.autoMiss,
  };
}

/**
 * Apply answers given on the notification card while the app wasn't listening, and return the
 * route of a notification the user tapped. Ids that aren't a class of this timetable are dropped.
 */
export async function drainAnswers(read: () => AppState, apply: (sessionId: string, mark: Mark) => void, now = new Date()): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) return;
  const { answers, route } = await Hadir.takeAnswers();
  if (answers.length) {
    const known = new Set(generateSessions(read(), now).map((s) => s.id));
    for (const a of answers) if (known.has(a.sessionId) && isMark(a.mark)) apply(a.sessionId, a.mark);
  }
  return route;
}

export async function notifyNow(title: string, body: string, route: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.schedule({
    notifications: [{ id: Math.floor(Math.random() * 1_000_000_000) + 1, title, body, extra: { route } }],
  });
}
