import { describe, expect, it } from "vitest";
import { addDays, atTime, hhmm, ymd } from "./time";

describe("time helpers", () => {
  it("addDays crosses month ends", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
  it("addDays goes backwards", () => expect(addDays("2026-10-01", -1)).toBe("2026-09-30"));
  it("atTime builds a local date", () => expect(atTime("2026-10-05", "08:30")).toEqual(new Date(2026, 9, 5, 8, 30)));
  it("ymd and hhmm pad", () => {
    const d = new Date(2026, 0, 2, 3, 4);
    expect(ymd(d)).toBe("2026-01-02");
    expect(hhmm(d)).toBe("03:04");
  });
});
