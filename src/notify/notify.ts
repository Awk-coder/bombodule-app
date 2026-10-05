import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AppState, Mark } from "../domain/types";
import { planNotifications } from "../domain/planner";

const ATTEND = "ATTEND";

export interface NotificationAction {
  actionId: string;
  sessionId?: string;
  route?: string;
}

export const isMark = (id: string): id is Mark => id === "attended" || id === "missed";

export async function initNotifications(onAction: (a: NotificationAction) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.registerActionTypes({
    types: [{ id: ATTEND, actions: [{ id: "attended", title: "Attended" }, { id: "missed", title: "Missed", destructive: true }] }],
  });
  await LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
    const extra = (e.notification.extra ?? {}) as { sessionId?: string; route?: string };
    onAction({ actionId: e.actionId, sessionId: extra.sessionId, route: extra.route });
  });
}

/** Cancel everything pending and schedule the next 14 days from scratch. */
export async function reschedule(state: AppState, now = new Date()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  const planned = planNotifications(state, now);
  if (!planned.length) return;
  await LocalNotifications.schedule({
    notifications: planned.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      schedule: { at: p.at, allowWhileIdle: true },
      actionTypeId: p.kind === "attendance" ? ATTEND : undefined,
      extra: { sessionId: p.sessionId, route: p.route },
    })),
  });
}

export async function notifyNow(title: string, body: string, route: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.schedule({
    notifications: [{ id: Math.floor(Math.random() * 1_000_000_000) + 1, title, body, extra: { route } }],
  });
}
