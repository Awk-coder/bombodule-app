import { describe, expect, it } from "vitest";
import { makeState } from "./testState";
import { generateTimetableIcs } from "./calendarExport";

describe("generateTimetableIcs", () => {
  it("generates a valid RFC 5545 iCalendar string from state", () => {
    const state = makeState();
    const ics = generateTimetableIcs(state);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=");
    expect(ics).toContain("BICS 4350");
    expect(ics).toContain("SUMMARY:BICS 4350 - PRIVACY ENGINEERING");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("returns empty string if no semester is set", () => {
    const state = { ...makeState(), semester: null };
    expect(generateTimetableIcs(state)).toBe("");
  });
});
