import { describe, expect, it } from "vitest";
import {
  applySync, deleteTask, setCourseStart, semesterLabelDiffers, isPaused, markSession, parseImport, serialize, setPaused, toggleTask, upsertTask,
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

describe("setCourseStart", () => {
  it("sets a course's actual first class, and clearing it goes back to the scheduled start", () => {
    const late = setCourseStart(makeState(), "BICS 4350-1", "2026-10-07");
    expect(late.courses[0].startFrom).toBe("2026-10-07");
    expect(late.courses[1].startFrom).toBeUndefined();
    expect("startFrom" in setCourseStart(late, "BICS 4350-1", null).courses[0]).toBe(false);
  });
});

describe("applySync", () => {
  it("first sync creates courses, deduped slots, semester and account", () => {
    const s = applySync(emptyState(), parsed({ sessionName: "Sem 1, 2030/2031" }), "2026-10-05");
    expect(s.courses.map((c) => [c.id, c.color, c.absenceLimit, c.active])).toEqual([
      ["BICS 4350-1", 0, 6, true],
      ["BIIT 2301-1", 1, 6, true],
    ]);
    expect(s.slots.map((x) => x.id)).toEqual(["BICS 4350-1-1-11:30", "BIIT 2301-1-2-08:30"]);
    expect(s.semester).toEqual({ label: "Sem 1, 2030/2031", start: "2026-10-05", end: "2027-01-11", autoMissFrom: "2026-10-05" });
    expect(s.account).toEqual({ name: "ABDUL WAHID", matric: "2212345", lastSync: "2026-10-05" });
  });

  it("re-sync in the same semester keeps start date, marks, colors and hides dropped courses", () => {
    const unlisted = "Sem 1, 2030/2031"; // not in the calendar, so the start date comes from the first import
    const first = markSession(applySync(emptyState(), parsed({ sessionName: unlisted }), "2026-10-05"), BICS_MON_1, "missed");
    const again = applySync(
      first,
      parsed({ sessionName: unlisted, courses: [parsed().courses[0]], slots: [parsed().slots[0]], studentName: null }),
      "2026-10-20",
    );
    expect(again.semester?.start).toBe("2026-10-05");
    expect(again.marks[BICS_MON_1]).toBe("missed");
    expect(again.courses.find((c) => c.id === "BICS 4350-1")).toMatchObject({ color: 0, active: true });
    expect(again.courses.find((c) => c.id === "BIIT 2301-1")).toMatchObject({ active: false });
    expect(again.account).toEqual({ name: "ABDUL WAHID", matric: "2212345", lastSync: "2026-10-20" });
  });

  it("re-sync keeps a course's late start in the same semester and drops it for a new one", () => {
    const first = setCourseStart(applySync(emptyState(), parsed(), "2026-10-05"), "BICS 4350-1", "2026-10-07");
    expect(applySync(first, parsed(), "2026-10-20").courses[0].startFrom).toBe("2026-10-07");
    expect(applySync(first, parsed({ sessionName: "Sem 2, 2026/2027" }), "2027-03-01", true).courses[0].startFrom).toBeUndefined();
  });

  it("re-sync with a moved slot keeps past marks counted", () => {
    const first = markSession(applySync(emptyState(), parsed(), "2026-10-05"), BICS_MON_1, "missed");
    const moved = parsed({
      slots: [
        { code: "BICS 4350", section: "1", day: 3, start: "14:00", end: "15:20", venue: "ICT LR 14", lecturer: "DR. X" },
        parsed().slots[2],
      ],
    });
    const again = applySync(first, moved, "2026-10-20");
    const sessions = generateSessions(again, new Date(2026, 9, 20, 7));
    expect(sessions.find((x) => x.id === BICS_MON_1)?.status).toBe("missed");
    const bics = sessions.filter((x) => x.courseId === "BICS 4350-1");
    expect(bics.filter((x) => x.date >= "2026-10-20").every((x) => x.slotId === "BICS 4350-1-3-14:00")).toBe(true);
    expect(bics.filter((x) => x.date < "2026-10-20").every((x) => x.slotId === "BICS 4350-1-1-11:30")).toBe(true);
  });

  it("a missing label keeps the current semester and its counts", () => {
    const first = applySync(emptyState(), parsed(), "2026-10-05");
    const s = applySync(first, parsed({ sessionName: null }), "2026-10-20");
    expect(s.semester).toEqual(first.semester);
  });

  it("a different label before the semester ends keeps it unless a new one is requested", () => {
    const first = applySync(emptyState(), parsed(), "2026-10-05");
    const kept = applySync(first, parsed({ sessionName: "Sem 2, 2026/2027" }), "2026-10-20");
    expect(kept.semester).toEqual(first.semester);
    const started = applySync(first, parsed({ sessionName: "Sem 2, 2026/2027" }), "2026-10-20", true);
    expect(started.semester).toMatchObject({ label: "Sem 2, 2026/2027", start: "2027-02-22" });
  });

  it("semesterLabelDiffers flags a new label only while the semester runs", () => {
    const first = applySync(emptyState(), parsed(), "2026-10-05");
    expect(semesterLabelDiffers(first, parsed({ sessionName: "Sem 2, 2026/2027" }), "2026-10-20")).toBe(true);
    expect(semesterLabelDiffers(first, parsed(), "2026-10-20")).toBe(false);
    expect(semesterLabelDiffers(first, parsed({ sessionName: null }), "2026-10-20")).toBe(false);
    expect(semesterLabelDiffers(first, parsed({ sessionName: "Sem 2, 2026/2027" }), "2027-03-01")).toBe(false);
  });

  it("first sync without a label still creates a semester", () => {
    expect(applySync(emptyState(), parsed({ sessionName: null }), "2026-10-05").semester?.label).toBe("Current semester");
  });

  it("a new semester label starts a new semester", () => {
    const s = applySync(applySync(emptyState(), parsed(), "2026-10-05"), parsed({ sessionName: "Sem 2, 2026/2027" }), "2027-03-01");
    expect(s.semester).toMatchObject({ label: "Sem 2, 2026/2027", start: "2027-02-22" });
  });

  it("a semester in IIUM's calendar takes its lecture dates and pauses the mid-semester break", () => {
    const s = applySync(emptyState(), parsed(), "2026-10-05");
    expect(s.semester).toEqual({ label: "Sem 1, 2026/2027", start: "2026-09-28", end: "2027-01-08", autoMissFrom: "2026-09-28" });
    expect(s.pauses).toEqual([{ from: "2026-11-14", to: "2026-11-22" }]);
    const days = new Set(generateSessions(s, new Date(2026, 9, 5, 7)).map((x) => x.date));
    expect(days.has("2026-09-28")).toBe(true);
    expect([...days].some((d) => d >= "2026-11-14" && d <= "2026-11-22")).toBe(false);
  });

  it("re-importing the same semester doesn't add the break twice", () => {
    const first = applySync(emptyState(), parsed(), "2026-10-05");
    expect(applySync(first, parsed(), "2026-10-20").pauses).toEqual(first.pauses);
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
  it("fills ranked fields missing from older saves", () => {
    const old = JSON.parse(serialize(makeState()));
    delete old.results;
    delete old.examsDone;
    delete old.achievements;
    const s = parseImport(JSON.stringify(old));
    expect(s.results).toEqual([]);
    expect(s.examsDone).toEqual([]);
    expect(s.achievements).toEqual({});
  });

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
