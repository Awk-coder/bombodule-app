import { describe, expect, it } from "vitest";
import {
  applySync, deleteTask, isPaused, markSession, parseImport, serialize, setPaused, toggleTask, upsertTask,
} from "./actions";
import { generateSessions } from "./sessions";
import { BICS_MON_1, makeState } from "./testState";
import { emptyState } from "./types";
import type { AppState, Task } from "./types";
import type { ParsedSchedule } from "../iium/parser";

const parsed = (over: Partial<ParsedSchedule> = {}): ParsedSchedule => ({
  sessionName: "Sem 1, 2026/2027",
  studentName: "ABDUL WAHID",
  matric: "2212345",
  courses: [
    { code: "BICS 4350", name: "PRIVACY ENGINEERING", section: "1" },
    { code: "BIIT 2301", name: "USER EXPERIENCE DESIGN", section: "1" },
  ],
  slots: [
    { code: "BICS 4350", section: "1", day: 1, start: "11:30", end: "12:50", venue: "ICT LR 14", lecturer: "DR. X" },
    { code: "BICS 4350", section: "1", day: 1, start: "11:30", end: "12:50", venue: "ICT LR 14", lecturer: "DR. X" },
    { code: "BIIT 2301", section: "1", day: 2, start: "08:30", end: "09:50", venue: "HCI LAB", lecturer: "DR. Y" },
  ],
  ...over,
});

describe("markSession", () => {
  it("stores the mark", () => {
    expect(markSession(makeState(), BICS_MON_1, "missed").marks[BICS_MON_1]).toBe("missed");
  });
});

describe("setPaused", () => {
  it("opens and closes a pause interval", () => {
    const p = setPaused(makeState(), true, "2026-10-07");
    expect(isPaused(p)).toBe(true);
    expect(p.pauses).toEqual([{ from: "2026-10-07", to: null }]);
    const r = setPaused(p, false, "2026-10-12");
    expect(isPaused(r)).toBe(false);
    expect(r.pauses).toEqual([{ from: "2026-10-07", to: "2026-10-11" }]);
  });

  it("pausing and resuming on the same day hides nothing", () => {
    const st = setPaused(setPaused(makeState(), true, "2026-10-05"), false, "2026-10-05");
    expect(generateSessions(st, new Date(2026, 9, 5, 7))).toHaveLength(6);
  });

  it("is a no-op when already in that state", () => {
    const s = makeState();
    expect(setPaused(s, false, "2026-10-05")).toBe(s);
  });
});

describe("applySync", () => {
  it("first sync creates courses, deduped slots, semester and account", () => {
    const s = applySync(emptyState(), parsed(), "2026-10-05");
    expect(s.courses.map((c) => [c.id, c.color, c.absenceLimit, c.active])).toEqual([
      ["BICS 4350-1", 0, 6, true],
      ["BIIT 2301-1", 1, 6, true],
    ]);
    expect(s.slots.map((x) => x.id)).toEqual(["BICS 4350-1-1-11:30", "BIIT 2301-1-2-08:30"]);
    expect(s.semester).toEqual({ label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2027-01-11" });
    expect(s.account).toEqual({ name: "ABDUL WAHID", matric: "2212345", lastSync: "2026-10-05" });
  });

  it("re-sync in the same semester keeps start date, marks, colors and hides dropped courses", () => {
    const first = markSession(applySync(emptyState(), parsed(), "2026-10-05"), BICS_MON_1, "missed");
    const again = applySync(
      first,
      parsed({ courses: [parsed().courses[0]], slots: [parsed().slots[0]], studentName: null }),
      "2026-10-20",
    );
    expect(again.semester?.start).toBe("2026-10-05");
    expect(again.marks[BICS_MON_1]).toBe("missed");
    expect(again.courses.find((c) => c.id === "BICS 4350-1")).toMatchObject({ color: 0, active: true });
    expect(again.courses.find((c) => c.id === "BIIT 2301-1")).toMatchObject({ active: false });
    expect(again.account).toEqual({ name: "ABDUL WAHID", matric: "2212345", lastSync: "2026-10-20" });
  });

  it("a new semester label starts a new semester", () => {
    const s = applySync(applySync(emptyState(), parsed(), "2026-10-05"), parsed({ sessionName: "Sem 2, 2026/2027" }), "2027-03-01");
    expect(s.semester).toMatchObject({ label: "Sem 2, 2026/2027", start: "2027-03-01" });
  });
});

describe("tasks", () => {
  const t: Task = { id: "t1", courseId: null, title: "Lab 1", due: "2026-10-07T15:59:00.000Z", note: "", done: false };

  it("upsert adds then replaces", () => {
    const b = upsertTask(upsertTask(makeState(), t), { ...t, title: "Lab 1 v2" });
    expect(b.tasks).toEqual([{ ...t, title: "Lab 1 v2" }]);
  });

  it("toggle and delete", () => {
    const a = toggleTask(upsertTask(makeState(), t), "t1");
    expect(a.tasks[0].done).toBe(true);
    expect(deleteTask(a, "t1").tasks).toEqual([]);
  });
});

describe("serialize / parseImport", () => {
  it("round-trips", () => {
    const s = markSession(makeState(), BICS_MON_1, "attended");
    expect(parseImport(serialize(s))).toEqual(s);
  });
  it("rejects non-JSON", () => expect(() => parseImport("not json")).toThrow("Not a valid backup file"));
  it("rejects other versions", () => {
    expect(() => parseImport(JSON.stringify({ ...makeState(), version: 2 }))).toThrow("Unsupported data version: 2");
  });
  it("rejects files missing data", () => expect(() => parseImport(JSON.stringify({ version: 1 }))).toThrow("Backup file is missing data"));
  it("fills in settings added later", () => {
    const old: Partial<AppState> = { ...makeState() };
    delete old.settings;
    expect(parseImport(JSON.stringify(old)).settings).toEqual(emptyState().settings);
  });
});
