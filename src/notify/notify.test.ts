import { beforeEach, describe, expect, it, vi } from "vitest";
import { markSession } from "../domain/actions";
import { BICS_MON_1, makeState } from "../domain/testState";
import type { AppState } from "../domain/types";

const log: string[] = [];
let releasePending: (() => void) | null = null;
let scheduled: { extra: { sessionId?: string } }[] = [];
let prompts: Record<string, unknown>[] = [];
let stored: { answers: { sessionId: string; mark: string }[]; route?: string } = { answers: [] };

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
vi.mock("../native/hadir", () => ({
  Hadir: {
    schedulePrompts: async (o: { items: Record<string, unknown>[] }) => {
      log.push("schedulePrompts");
      prompts = o.items;
    },
    takeAnswers: async () => {
      const out = stored;
      stored = { answers: [] };
      return out;
    },
  },
}));

const { drainAnswers, reschedule } = await import("./notify");

beforeEach(() => {
  log.length = 0;
  releasePending = null;
  scheduled = [];
  prompts = [];
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
    expect(log).toEqual(["getPending", "schedulePrompts", "getPending", "schedulePrompts"]);
    expect(prompts.some((n) => n.sessionId === BICS_MON_1)).toBe(false);
  });

  it("sends class prompts to the native card scheduler and keeps tasks on LocalNotifications", async () => {
    releasePending = () => {};
    const state = makeState({ tasks: [{ id: "t1", title: "Lab", courseId: null, due: new Date(2026, 9, 8, 23, 59).toISOString(), note: "", done: false }] });
    await reschedule(() => state, new Date(2026, 9, 5, 7));
    expect(scheduled).toHaveLength(1);
    expect(prompts[0]).toEqual({
      id: expect.any(Number), at: new Date(2026, 9, 5, 11, 30).getTime(), kind: "attendance", sessionId: BICS_MON_1,
      title: "Did you attend BICS 4350?", body: expect.any(String), route: "#/home",
      code: "BICS 4350", name: "Privacy Engineering", venue: "ICT LR 14", time: "11:30 AM - 12:50 PM",
      missed: 0, limit: 6, color: 0, autoMiss: false,
    });
  });

  it("sends the end-of-day nudge with its unmarked classes so the card can drop ones answered since", async () => {
    releasePending = () => {};
    await reschedule(() => makeState(), new Date(2026, 9, 5, 7));
    expect(prompts.find((p) => p.kind === "nudge")).toEqual({
      id: expect.any(Number), at: new Date(2026, 9, 5, 14, 50).getTime(), kind: "nudge",
      title: "Mark today's classes", body: "1 unmarked: BICS 4350", route: "#/home",
      pending: [{ sessionId: BICS_MON_1, code: "BICS 4350" }],
    });
  });
});

describe("drainAnswers", () => {
  it("applies answers for real classes, ignores unknown ids, and returns the tapped route", async () => {
    stored = { answers: [{ sessionId: BICS_MON_1, mark: "attended" }, { sessionId: "TEST@2026-10-05", mark: "missed" }], route: "#/course/X" };
    const applied: string[] = [];
    const route = await drainAnswers(() => makeState(), (id, mark) => applied.push(`${id}=${mark}`), new Date(2026, 9, 5, 14));
    expect(applied).toEqual([`${BICS_MON_1}=attended`]);
    expect(route).toBe("#/course/X");
  });
});
