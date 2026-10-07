import { describe, expect, it } from "vitest";
import { cgpa, degree, missingSemesters, eloFromGpa, gpa, labelKey, rankOf, semesterMismatch, sortResults, tierOf } from "./grades";
import { result } from "./testState";

const REAL = result("Sem 2, 2025/2026", [["BICS 2304", "F"], ["BICS 4336", "A-"], ["BICS 4340", "C+"], ["BICS 4350", "B-"], ["BIIT 2301", "D"], ["EECE 1313", "E"], ["UNGS 1301", "C+"]]);

describe("gpa", () => {
  it("matches the real slip", () => {
    expect(gpa(REAL.courses)).toEqual({ gpa: 1.95, credits: 21, points: 41.01 });
  });
  it("skips grades without points, counts Y as zero", () => {
    expect(gpa(result("x", [["A 1000", "A"], ["B 1000", "W"], ["C 1000", "EX"]]).courses).gpa).toBe(4);
    expect(gpa(result("x", [["A 1000", "A"], ["B 1000", "Y"]]).courses).gpa).toBe(2);
  });
});

describe("tiers and elo", () => {
  it.each([[4, "S"], [3.67, "S"], [3.66, "A"], [3.5, "A"], [3, "B"], [2.54, "C"], [2, "D"], [1.95, "F"]] as const)("%s → %s", (g, t) => expect(tierOf(g).tier).toBe(t));
  it.each([[1.95, 585], [2.54, 924], [2, 600], [3.67, 2000], [4, 2300], [0, 0]] as const)("gpa %s → elo %s", (g, e) => expect(eloFromGpa(g)).toBe(e));
  it("ranks", () => {
    expect(rankOf(585)).toMatchObject({ ore: "coal", div: 3, min: 500, next: 600 });
    expect(rankOf(924)).toMatchObject({ ore: "gold", div: 1, next: 1000 });
    expect(rankOf(924).progress).toBeCloseTo(0.24);
    expect(rankOf(2100)).toMatchObject({ ore: "netherite", div: null, next: null, progress: 1 });
  });
});

describe("cgpa", () => {
  const s1 = result("Sem 1, 2025/2026", [["BIIT 2301", "F"], ["X 1000", "A"]]);
  const s2 = result("Sem 2, 2025/2026", [["BIIT 2301", "B"]]);
  it("orders by session then semester", () => {
    expect(labelKey("Sem 2, 2025/2026")).toBe("2025-2");
    expect(sortResults([s2, s1]).map((r) => r.label)).toEqual([s1.label, s2.label]);
  });
  it("a passed retake replaces the fail", () => {
    expect(cgpa([s2, s1])).toEqual({ cgpa: 3.5, credits: 6, points: 21 });
  });
  it("a lower retake of a passed course keeps the better grade", () => {
    const s3 = result("Sem 1, 2026/2027", [["X 1000", "C"]]);
    expect(cgpa([s1, s2, s3]).cgpa).toBe(3.5);
  });
});

describe("degree", () => {
  it("unlocks when computed totals match the latest slip", () => {
    const ok = { ...REAL, printed: { ...REAL.printed, cgpa: 1.95, cumCredits: 21 } };
    expect(degree([ok])).toMatchObject({ cgpa: 1.95, ok: true, reason: null });
  });
  it("stays locked when semesters are missing", () => {
    const d = degree([{ ...REAL, printed: { ...REAL.printed, cgpa: 2.54, cumCredits: 68.5 } }])!;
    expect(d.ok).toBe(false);
    expect(d.reason).toContain("Import the slips before");
  });
  it("is null with no slips", () => expect(degree([])).toBeNull());
  it("flags a GPA the app can't reproduce", () => {
    expect(semesterMismatch(REAL)).toBeNull();
    expect(semesterMismatch({ ...REAL, printed: { ...REAL.printed, gpa: 2.1 } })).toContain("2.10");
  });
});

describe("missingSemesters", () => {
  it("names regular semesters skipped between imported slips", () => {
    const rs = [result("Sem 1, 2024/2025", [["X 1", "A"]]), result("Sem 1, 2025/2026", [["X 2", "A"]])];
    expect(missingSemesters(rs)).toEqual(["Sem 2, 2024/2025"]);
  });

  it("is empty when the slips run back to back", () => {
    expect(missingSemesters([result("Sem 2, 2024/2025", [["X 1", "A"]]), result("Sem 1, 2025/2026", [["X 2", "A"]])])).toEqual([]);
  });

  it("degree says which semesters are missing", () => {
    const last = result("Sem 1, 2025/2026", [["X 2", "A"]], { printed: { gpa: 4, cgpa: 4, credits: 3, cumCredits: 9, cumPoints: 36 } });
    expect(degree([result("Sem 1, 2024/2025", [["X 1", "A"]]), last])!.reason).toContain("Sem 2, 2024/2025");
  });

  it("degree asks for slips before the first one when nothing is skipped", () => {
    const only = result("Sem 1, 2025/2026", [["X 2", "A"]], { printed: { gpa: 4, cgpa: 4, credits: 3, cumCredits: 9, cumPoints: 36 } });
    expect(degree([only])!.reason).toContain("before Sem 1, 2025/2026");
  });
});
