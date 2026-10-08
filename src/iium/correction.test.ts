import { describe, expect, it } from "vitest";
import {
  cleanOcrCourseCode,
  cleanOcrGrade,
  cleanOcrNumber,
  validateAndCorrectResults,
} from "./correction";

describe("cleanOcrNumber", () => {
  it("replaces OCR letter confusions with digits", () => {
    expect(cleanOcrNumber("l3")).toBe("13");
    expect(cleanOcrNumber("I3")).toBe("13");
    expect(cleanOcrNumber("|3")).toBe("13");
    expect(cleanOcrNumber("4l.68")).toBe("41.68");
    expect(cleanOcrNumber("8.O1")).toBe("8.01");
    expect(cleanOcrNumber(".00")).toBe("0.00");
    expect(cleanOcrNumber(".5")).toBe("0.5");
  });
});

describe("cleanOcrGrade", () => {
  it("normalizes common OCR grade confusions", () => {
    expect(cleanOcrGrade("8")).toBe("B");
    expect(cleanOcrGrade("8+")).toBe("B+");
    expect(cleanOcrGrade("8-")).toBe("B-");
    expect(cleanOcrGrade("a-")).toBe("A-");
    expect(cleanOcrGrade("A—")).toBe("A-");
    expect(cleanOcrGrade("P4")).toBe("PA");
  });
});

describe("cleanOcrCourseCode", () => {
  it("fixes digits in course numbers and letters in prefixes", () => {
    expect(cleanOcrCourseCode("B1CS 1301")).toBe("BICS 1301");
    expect(cleanOcrCourseCode("BICS 13O1")).toBe("BICS 1301");
    expect(cleanOcrCourseCode("BICS l301")).toBe("BICS 1301");
    expect(cleanOcrCourseCode("BICS1301")).toBe("BICS 1301");
  });
});

describe("validateAndCorrectResults", () => {
  it("passes when courses, grade points, quality points and totals match", () => {
    const courses = [
      { code: "BICS 1301", title: "Prog", credits: 3, grade: "B+", point: 3.33, qPoint: 9.99 },
      { code: "BICS 1302", title: "Comp", credits: 3, grade: "A-", point: 3.67, qPoint: 11.01 },
    ];
    const res = validateAndCorrectResults(courses, { gpa: 3.5, credits: 6, totalPoints: 21 });
    expect(res.ok).toBe(true);
    expect(res.warnings).toHaveLength(0);
  });

  it("flags unrecognized grades", () => {
    const courses = [{ code: "BICS 1301", title: "Prog", credits: 3, grade: "Z", point: 0 }];
    const res = validateAndCorrectResults(courses);
    expect(res.ok).toBe(false);
    expect(res.warnings[0]).toContain('unrecognized grade "Z"');
  });

  it("trusts the standard grade-to-point table when printed point disagrees", () => {
    const courses = [{ code: "BICS 1301", title: "Prog", credits: 3, grade: "B+", point: 2.0 }];
    const res = validateAndCorrectResults(courses);
    expect(res.warnings[0]).toContain("printed point 2.00 disagrees with standard 3.33. Corrected.");
    expect(courses[0].point).toBe(3.33);
  });

  it("flags quality point mismatches", () => {
    const courses = [{ code: "BICS 1301", title: "Prog", credits: 3, grade: "B+", point: 3.33, qPoint: 8.0 }];
    const res = validateAndCorrectResults(courses);
    expect(res.ok).toBe(false);
    expect(res.warnings[0]).toContain("quality point mismatch");
  });

  it("flags totals mismatches", () => {
    const courses = [{ code: "BICS 1301", title: "Prog", credits: 3, grade: "A", point: 4.0, qPoint: 12.0 }];
    const res = validateAndCorrectResults(courses, { credits: 4, gpa: 4.0, totalPoints: 12.0 });
    expect(res.ok).toBe(false);
    expect(res.warnings[0]).toContain("Total credit hours mismatch");
  });
});
