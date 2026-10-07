import { describe, expect, it } from "vitest";
import { notifId, planNotifications, warningFor } from "./planner";
import { BICS_MON_1, course, makeState, slot } from "./testState";
import { DEFAULT_SETTINGS } from "./types";
import type { Task } from "./types";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe("planNotifications: end-of-day nudge", () => {
  const twoOnMonday = () => makeState({ slots: [...makeState().slots, slot("BIIT 2301-1", 1, "14:00", "15:20")] });
  const BIIT_MON = "BIIT 2301-1-1-14:00@2026-10-05";

  it("reminds 2 hours after the day's last class about every class still unmarked", () => {
    const n = planNotifications(twoOnMonday(), at(5, 7)).filter((x) => x.kind === "nudge");
    expect(n[0]).toMatchObject({
      at: at(5, 17, 20),
      title: "Mark today's classes",
      body: "2 unmarked: BICS 4350, BIIT 2301",
      route: "#/home",
      pending: [{ sessionId: BICS_MON_1, code: "BICS 4350" }, { sessionId: BIIT_MON, code: "BIIT 2301" }],
    });
    expect(n.map((x) => x.at.getDate())).toEqual([5, 6, 7, 12, 13, 14]);
  });

  it("lists only the unmarked classes, and skips a fully marked day", () => {
    const st = makeState({ slots: twoOnMonday().slots, marks: { [BICS_MON_1]: "attended" } });
    expect(planNotifications(st, at(5, 7)).find((x) => x.kind === "nudge")).toMatchObject({ body: "1 unmarked: BIIT 2301", pending: [{ sessionId: BIIT_MON, code: "BIIT 2301" }] });
    const done = makeState({ slots: twoOnMonday().slots, marks: { [BICS_MON_1]: "attended", [BIIT_MON]: "missed" } });
    expect(planNotifications(done, at(5, 7)).find((x) => x.kind === "nudge")?.at.getDate()).toBe(6);
  });

  it("skips a nudge whose time has passed", () => {
    expect(planNotifications(twoOnMonday(), at(5, 17, 30)).find((x) => x.kind === "nudge")?.at.getDate()).toBe(6);
  });
});

describe("planNotifications: attendance", () => {
  it("plans a prompt at the start of every future unmarked class", () => {
    const p = planNotifications(makeState(), at(5, 7)).filter((x) => x.kind === "attendance");
    expect(p).toHaveLength(6);
    expect(p[0]).toMatchObject({
      at: at(5, 11, 30),
      title: "Did you attend BICS 4350?",
      body: "PRIVACY ENGINEERING · ICT LR 14",
      sessionId: BICS_MON_1,
      route: "#/home",
    });
  });

  it("skips marked and already-prompted classes and honours the delay", () => {
    const st = makeState({
      marks: { "BIIT 2301-1-2-08:30@2026-10-06": "attended" },
      settings: { ...DEFAULT_SETTINGS, promptDelayMin: 10 },
    });
    const p = planNotifications(st, at(5, 13)).filter((x) => x.kind === "attendance");
    expect(p.map((x) => x.sessionId)).toEqual([
      "BICS 4350-1-3-11:30@2026-10-07",
      "BICS 4350-1-1-11:30@2026-10-12",
      "BIIT 2301-1-2-08:30@2026-10-13",
      "BICS 4350-1-3-11:30@2026-10-14",
    ]);
    expect(p[0].at).toEqual(at(7, 11, 40));
  });

  it("gives each prompt the data its card shows", () => {
    const st = makeState({ marks: { "BICS 4350-1-1-11:30@2026-10-05": "missed" } });
    const p = planNotifications(st, at(5, 13)).find((x) => x.sessionId === "BICS 4350-1-3-11:30@2026-10-07");
    expect(p?.card).toEqual({
      code: "BICS 4350", name: "PRIVACY ENGINEERING", venue: "ICT LR 14", start: "11:30", end: "12:50",
      missed: 1, limit: 6, color: 0, autoMiss: false,
    });
  });

  it("stops at the horizon", () => {
    expect(planNotifications(makeState(), at(5, 7), 3).filter((x) => x.kind === "attendance")).toHaveLength(3);
  });

  it("plans nothing while paused", () => {
    expect(planNotifications(makeState({ pauses: [{ from: "2026-10-05", to: null }] }), at(5, 7))).toEqual([]);
  });

  it("gives stable, unique ids so re-scheduling never duplicates", () => {
    const a = planNotifications(makeState(), at(5, 7));
    const b = planNotifications(makeState(), at(5, 8));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
    for (const x of a) {
      expect(Number.isInteger(x.id)).toBe(true);
      expect(x.id).toBeGreaterThan(0);
      expect(x.id).toBeLessThan(2 ** 31);
    }
  });
});

describe("planNotifications: unanswered-class warning", () => {
  const tracked = (marks: Record<string, "missed" | "attended">) =>
    makeState({ semester: { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2026-10-18", autoMissFrom: "2026-10-05" }, marks });
  const limit4 = (st: ReturnType<typeof tracked>) => ({ ...st, courses: st.courses.map((c) => (c.code === "BICS 4350" ? { ...c, absenceLimit: 4 } : c)) });
  const twoMissed = { [BICS_MON_1]: "missed" as const, "BICS 4350-1-3-11:30@2026-10-07": "missed" as const };

  it("warns at midnight when leaving the next class unanswered would put the course one below the limit", () => {
    const w = planNotifications(limit4(tracked(twoMissed)), at(12, 7)).filter((x) => x.kind === "warning");
    expect(w).toEqual([
      expect.objectContaining({ sessionId: "BICS 4350-1-1-11:30@2026-10-12", at: at(13, 0), title: "Absence warning", body: "BICS 4350: not answered, counted as missed — 3 / 4, one more and you're barred", route: "#/course/BICS%204350-1" }),
    ]);
  });

  it("plans no warning while the course is far from the limit or tracking is off", () => {
    expect(planNotifications(tracked({}), at(5, 7)).filter((x) => x.kind === "warning")).toEqual([]);
    expect(planNotifications(limit4(makeState({ marks: twoMissed })), at(12, 7)).filter((x) => x.kind === "warning")).toEqual([]);
  });

  it("tells you in the prompt that no answer counts as missed", () => {
    const p = planNotifications(tracked({}), at(5, 7)).find((x) => x.kind === "attendance");
    expect(p?.body).toBe("PRIVACY ENGINEERING · ICT LR 14 · no answer by midnight = missed");
  });
});

describe("planNotifications: tasks", () => {
  const task = (due: Date, done = false): Task => ({ id: "t1", courseId: "BICS 4350-1", title: "Lab report", due: due.toISOString(), note: "", done });

  it("reminds the day before at the reminder time", () => {
    const p = planNotifications(makeState({ semester: null, tasks: [task(at(9, 23, 59))] }), at(5, 7));
    expect(p).toEqual([
      { id: notifId("t:t1"), at: at(8, 20), kind: "task", title: "Due tomorrow: Lab report", body: "BICS 4350 · due 23:59", route: "#/tasks" },
    ]);
  });

  it("skips a reminder whose time already passed", () => {
    expect(planNotifications(makeState({ semester: null, tasks: [task(at(6, 10))] }), at(5, 21))).toEqual([]);
  });

  it("skips done tasks", () => {
    expect(planNotifications(makeState({ semester: null, tasks: [task(at(9, 10), true)] }), at(5, 7))).toEqual([]);
  });
});

describe("warningFor", () => {
  const c = course("BICS 4350", "X");
  it("warns one below the limit", () => expect(warningFor(c, 4, 5)).toBe("BICS 4350: 5 / 6 missed — one more and you're barred"));
  it("warns at the limit", () => expect(warningFor(c, 5, 6)).toBe("BICS 4350: 6 / 6 missed — you've reached the bar limit"));
  it("stays quiet otherwise", () => {
    expect(warningFor(c, 3, 4)).toBeNull();
    expect(warningFor(c, 5, 5)).toBeNull();
    expect(warningFor(c, 5, 4)).toBeNull();
  });
});
