import { describe, expect, it } from "vitest";
import { generateSessions, isPausedOn } from "./sessions";
import { BICS_MON_1, makeState } from "./testState";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe("generateSessions", () => {
  it("creates one session per slot occurrence in the semester, sorted", () => {
    const s = generateSessions(makeState(), at(5, 7));
    expect(s.map((x) => x.id)).toEqual([
      "BICS 4350-1-1-11:30@2026-10-05",
      "BIIT 2301-1-2-08:30@2026-10-06",
      "BICS 4350-1-3-11:30@2026-10-07",
      "BICS 4350-1-1-11:30@2026-10-12",
      "BIIT 2301-1-2-08:30@2026-10-13",
      "BICS 4350-1-3-11:30@2026-10-14",
    ]);
    expect(s[0].start).toEqual(at(5, 11, 30));
    expect(s[0].end).toEqual(at(5, 12, 50));
  });

  it("is upcoming until the class ends, then unmarked", () => {
    const s = generateSessions(makeState(), at(6, 9));
    expect(s[0].status).toBe("unmarked");
    expect(s[1].status).toBe("upcoming"); // Tue 08:30-09:50 still running
  });

  it("counts a class not answered by the end of its day as missed", () => {
    const st = makeState({ semester: { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2026-10-18", autoMissFrom: "2026-10-05" } });
    const s = generateSessions(st, at(6, 13));
    expect(s[0]).toMatchObject({ id: BICS_MON_1, status: "missed", assumed: true }); // yesterday, never answered
    expect(s[1]).toMatchObject({ status: "unmarked" }); // ended today, still time to answer
    expect(s[1].assumed).toBeUndefined();
  });

  it("leaves classes from before tracking began unmarked, and a mark always wins", () => {
    const st = makeState({
      semester: { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2026-10-18", autoMissFrom: "2026-10-07" },
      marks: { "BIIT 2301-1-2-08:30@2026-10-06": "attended" },
    });
    const s = generateSessions(st, at(9, 9));
    expect(s.slice(0, 3).map((x) => x.status)).toEqual(["unmarked", "attended", "missed"]);
  });

  it("uses the saved mark", () => {
    const s = generateSessions(makeState({ marks: { [BICS_MON_1]: "missed" } }), at(6, 9));
    expect(s[0].status).toBe("missed");
  });

  it("skips paused days but keeps sessions already marked", () => {
    const state = makeState({ pauses: [{ from: "2026-10-05", to: "2026-10-11" }], marks: { [BICS_MON_1]: "attended" } });
    expect(generateSessions(state, at(5, 7)).map((x) => x.id)).toEqual([
      BICS_MON_1,
      "BICS 4350-1-1-11:30@2026-10-12",
      "BIIT 2301-1-2-08:30@2026-10-13",
      "BICS 4350-1-3-11:30@2026-10-14",
    ]);
  });

  it("an open pause hides everything from its start", () => {
    expect(generateSessions(makeState({ pauses: [{ from: "2026-10-07", to: null }] }), at(5, 7))).toHaveLength(2);
  });

  it("skips a course's classes before its actual start date, marked or not", () => {
    const st = makeState({ marks: { [BICS_MON_1]: "attended" } });
    st.courses[0] = { ...st.courses[0], startFrom: "2026-10-07" };
    const bics = generateSessions(st, at(20, 7)).filter((x) => x.courseId === "BICS 4350-1");
    expect(bics.map((x) => x.date)).toEqual(["2026-10-07", "2026-10-12", "2026-10-14"]);
    expect(generateSessions(st, at(20, 7)).filter((x) => x.courseId === "BIIT 2301-1")).toHaveLength(2);
  });

  it("ignores inactive courses", () => {
    const st = makeState();
    st.courses[1] = { ...st.courses[1], active: false };
    expect(generateSessions(st, at(5, 7)).every((x) => x.courseId === "BICS 4350-1")).toBe(true);
  });

  it("returns nothing without a semester", () => {
    expect(generateSessions(makeState({ semester: null }), at(5, 7))).toEqual([]);
  });
});

describe("isPausedOn", () => {
  it("treats from/to as inclusive", () => {
    const p = [{ from: "2026-10-05", to: "2026-10-06" }];
    expect(isPausedOn(p, "2026-10-04")).toBe(false);
    expect(isPausedOn(p, "2026-10-05")).toBe(true);
    expect(isPausedOn(p, "2026-10-06")).toBe(true);
    expect(isPausedOn(p, "2026-10-07")).toBe(false);
  });
});
