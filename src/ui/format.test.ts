import { describe, expect, it } from "vitest";
import { fmtDate, fmtTime, greeting, initials, minutesLeft, relDue, shortName, titleCase } from "./format";

describe("format", () => {
  it.each([
    ["08:30", "08:30 AM"],
    ["12:50", "12:50 PM"],
    ["14:00", "02:00 PM"],
    ["00:15", "12:15 AM"],
  ])("fmtTime %s", (a, b) => expect(fmtTime(a)).toBe(b));

  it("fmtDate", () => expect(fmtDate("2026-10-05")).toBe("Mon 5 Oct"));

  it("relDue", () => {
    const now = new Date(2026, 9, 5, 12);
    expect(relDue(new Date(2026, 9, 5, 12, 30), now)).toBe("in 30m");
    expect(relDue(new Date(2026, 9, 5, 15), now)).toBe("in 3h");
    expect(relDue(new Date(2026, 9, 8, 12), now)).toBe("in 3d");
    expect(relDue(new Date(2026, 9, 4, 12), now)).toBe("overdue 1d");
  });

  it("greeting", () => {
    expect(greeting(new Date(2026, 9, 5, 9))).toBe("Good morning,");
    expect(greeting(new Date(2026, 9, 5, 13))).toBe("Good afternoon,");
    expect(greeting(new Date(2026, 9, 5, 20))).toBe("Good evening,");
  });

  it("names", () => {
    expect(titleCase("PRIVACY ENGINEERING")).toBe("Privacy Engineering");
    expect(shortName("ABDUL WAHID BIN EXAMPLE")).toBe("Abdul Wahid");
    expect(initials("ABDUL WAHID BIN EXAMPLE")).toBe("AW");
    expect(initials(null)).toBe("?");
  });

  it("minutesLeft", () => expect(minutesLeft(new Date(2026, 9, 5, 12, 50), new Date(2026, 9, 5, 12, 42))).toBe(8));
});
