import { beforeEach, describe, expect, it, vi } from "vitest";
import { markSession } from "../domain/actions";
import { BICS_MON_1, makeState } from "../domain/testState";
import type { AppState } from "../domain/types";

const log: string[] = [];
let releasePending: (() => void) | null = null;
let scheduled: { extra: { sessionId?: string } }[] = [];

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: async () => {
      log.push("getPending");
      if (!releasePending) await new Promise<void>((r) => (releasePending = r));
      return { notifications: [] };
    },
    cancel: async () => {},
    schedule: async (o: { notifications: { extra: { sessionId?: string } }[] }) => {
      log.push("schedule");
      scheduled = o.notifications;
    },
  },
}));

const { reschedule } = await import("./notify");

beforeEach(() => {
  log.length = 0;
  releasePending = null;
  scheduled = [];
});

describe("reschedule", () => {
  it("serializes runs and plans from the latest state", async () => {
    let state: AppState = makeState();
    const now = new Date(2026, 9, 5, 7);
    const first = reschedule(() => state, now);
    state = markSession(state, BICS_MON_1, "attended"); // user marks while the first run is in flight
    const second = reschedule(() => state, now);
    await vi.waitFor(() => expect(releasePending).not.toBeNull());
    releasePending!();
    await Promise.all([first, second]);
    expect(log).toEqual(["getPending", "schedule", "getPending", "schedule"]);
    expect(scheduled.some((n) => n.extra.sessionId === BICS_MON_1)).toBe(false);
  });
});
