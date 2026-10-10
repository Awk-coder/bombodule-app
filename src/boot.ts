import { App as CapApp } from "@capacitor/app";
import { markSession } from "./domain/actions";
import { courseStats } from "./domain/attendance";
import { warningFor } from "./domain/planner";
import { generateSessions } from "./domain/sessions";
import type { AppState } from "./domain/types";
import { Hadir } from "./native/hadir";
import { startProfileSync } from "./online/sync";
import { drainAnswers, initNotifications, isMark, notifyNow, reschedule } from "./notify/notify";
import { dispatch, getState, loadState, onStateChange } from "./store/store";
import { courseHref } from "./ui/router";

async function warnIfNeeded(prev: AppState, next: AppState): Promise<void> {
  const now = new Date();
  const before = generateSessions(prev, now);
  const after = generateSessions(next, now);
  for (const c of next.courses) {
    const msg = warningFor(c, courseStats(c, before).missed, courseStats(c, after).missed);
    if (msg) await notifyNow("Absence warning", msg, courseHref(c.id));
  }
}

export async function boot(): Promise<void> {
  await loadState();

  if (import.meta.env.DEV && (!getState().onboarded || new URLSearchParams(location.search).has("seed"))) {
    const { seedState } = await import("./dev/seed");
    dispatch(() => seedState(new Date()));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const rescheduleSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void reschedule(getState), 500);
  };

  onStateChange((prev, next) => {
    rescheduleSoon();
    if (prev.marks !== next.marks && next.settings.warningsEnabled) void warnIfNeeded(prev, next);
  });

  await initNotifications(({ actionId, sessionId, route }) => {
    if (sessionId && isMark(actionId)) dispatch((s) => markSession(s, sessionId, actionId));
    location.hash = route ?? "#/home";
  });

  // Answers from the prompt cards wait natively until the app picks them up.
  const drain = async () => {
    const route = await drainAnswers(getState, (id, mark) => dispatch((s) => markSession(s, id, mark)));
    if (route) location.hash = route;
  };
  await drain();
  void Hadir.addListener("answer", () => void drain());

  rescheduleSoon();
  startProfileSync(getState, onStateChange);
  void CapApp.addListener("resume", () => {
    void drain();
    rescheduleSoon();
  });
}
