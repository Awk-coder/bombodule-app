import { describe, expect, it } from "vitest";
import { getSemesterTotalWeeks, getSemesterWeek, isFinalExamTaskVisible } from "./calendar";
import { parseYmd } from "./time";
import type { Semester } from "./types";

describe("academic calendar and final exam visibility", () => {
  const sem1: Semester = {
    label: "Sem 1, 2026/2027",
    start: "2026-09-28",
    end: "2027-01-08",
  };

  it("calculates total academic weeks correctly", () => {
    expect(getSemesterTotalWeeks(sem1)).toBe(14);
  });

  it("calculates week 1 at semester start", () => {
    expect(getSemesterWeek(sem1, parseYmd("2026-09-28"))).toBe(1);
    expect(isFinalExamTaskVisible(sem1, parseYmd("2026-09-28"))).toBe(false);
  });

  it("calculates week 6 mid-semester", () => {
    // 2026-11-05 is in week 6
    expect(getSemesterWeek(sem1, parseYmd("2026-11-05"))).toBe(6);
    expect(isFinalExamTaskVisible(sem1, parseYmd("2026-11-05"))).toBe(false);
  });

  it("hides finals before week 12 (e.g. week 11)", () => {
    // 2026-12-21 is week 11
    expect(getSemesterWeek(sem1, parseYmd("2026-12-21"))).toBe(11);
    expect(isFinalExamTaskVisible(sem1, parseYmd("2026-12-21"))).toBe(false);
  });

  it("unlocks finals once week 12 begins", () => {
    // 2026-12-28 is week 12
    expect(getSemesterWeek(sem1, parseYmd("2026-12-28"))).toBe(12);
    expect(isFinalExamTaskVisible(sem1, parseYmd("2026-12-28"))).toBe(true);
  });

  it("remains visible during finals and after semester ends", () => {
    // 2027-01-05 is week 13
    expect(isFinalExamTaskVisible(sem1, parseYmd("2027-01-05"))).toBe(true);
    // After semester ends (exam period)
    expect(isFinalExamTaskVisible(sem1, parseYmd("2027-01-15"))).toBe(true);
  });

  it("handles short semester (Sem 3) unlocking at totalWeeks - 2", () => {
    const sem3: Semester = {
      label: "Sem 3, 2026/2027",
      start: "2027-07-19",
      end: "2027-09-03",
    };
    expect(getSemesterTotalWeeks(sem3)).toBe(7);
    // Week 1 -> hidden
    expect(isFinalExamTaskVisible(sem3, parseYmd("2027-07-20"))).toBe(false);
    // Week 5 (7 - 2) -> unlocked
    expect(getSemesterWeek(sem3, parseYmd("2027-08-18"))).toBeGreaterThanOrEqual(5);
    expect(isFinalExamTaskVisible(sem3, parseYmd("2027-08-18"))).toBe(true);
  });

  it("returns true when semester is null", () => {
    expect(isFinalExamTaskVisible(null, new Date())).toBe(true);
  });
});
