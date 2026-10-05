import { describe, expect, it } from "vitest";
import { courseStats, riskOf } from "./attendance";
import { course } from "./testState";
import type { Session, SessionStatus } from "./types";

const C = course("BICS 4350", "X");

function seq(statuses: SessionStatus[], courseId = C.id): Session[] {
  return statuses.map((status, i) => ({
    id: `s${i}`,
    slotId: "x",
    courseId,
    date: "2026-10-05",
    start: new Date(2026, 9, 5 + i, 8),
    end: new Date(2026, 9, 5 + i, 9),
    status,
  }));
}

describe("riskOf (limit 6)", () => {
  it.each([
    [0, "ok"],
    [3, "ok"],
    [4, "warn"],
    [5, "danger"],
    [6, "barred"],
    [7, "barred"],
  ] as const)("%i missed → %s", (missed, risk) => expect(riskOf(missed, 6)).toBe(risk));
});

describe("courseStats", () => {
  it("counts and streaks, skipping unmarked", () => {
    const st = courseStats(C, seq(["attended", "attended", "missed", "attended", "attended", "attended", "unmarked", "attended", "upcoming"]));
    expect(st).toEqual({ attended: 6, missed: 1, unmarked: 1, limit: 6, canStillMiss: 4, risk: "ok", currentStreak: 4, bestStreak: 4 });
  });

  it("current streak resets on the latest miss", () => {
    const st = courseStats(C, seq(["attended", "attended", "attended", "missed"]));
    expect(st.currentStreak).toBe(0);
    expect(st.bestStreak).toBe(3);
  });

  it("canStillMiss never goes negative", () => {
    const st = courseStats(C, seq(Array<SessionStatus>(7).fill("missed")));
    expect(st.canStillMiss).toBe(0);
    expect(st.risk).toBe("barred");
  });

  it("only counts its own course", () => {
    expect(courseStats(C, seq(["missed", "missed"], "OTHER-1")).missed).toBe(0);
  });
});
