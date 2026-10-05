// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import html from "../../tests/fixtures/schedule.html?raw";
import { parseDays, parseSchedule, parseTimeRange } from "./parser";

const real = import.meta.glob("../../tests/fixtures/real-schedule.html", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const realHtml = Object.values(real)[0];

describe("parseDays", () => {
  it.each([
    ["M-W", [1, 3]],
    ["T-TH", [2, 4]],
    ["MON - WED", [1, 3]],
    ["TH", [4]],
    ["F", [5]],
    ["SAT", [6]],
    ["-", []],
  ] as const)("%s", (text, days) => expect(parseDays(text)).toEqual(days));
});

describe("parseTimeRange", () => {
  it("parses 24h ranges", () => expect(parseTimeRange("1130 - 1250")).toEqual(["11:30", "12:50"]));
  it("pads 3-digit morning times", () => expect(parseTimeRange("830-950")).toEqual(["08:30", "09:50"]));
  it("treats hours before 8 as afternoon", () => expect(parseTimeRange("200 - 320")).toEqual(["14:00", "15:20"]));
  it("rejects junk", () => {
    expect(parseTimeRange("-")).toBeNull();
    expect(parseTimeRange("TBA")).toBeNull();
  });
});

describe("parseSchedule (fixture)", () => {
  const p = parseSchedule(html);

  it("reads semester, name and matric", () => {
    expect(p.sessionName).toBe("Sem 1, 2026/2027");
    expect(p.studentName).toBe("ABDUL WAHID BIN EXAMPLE");
    expect(p.matric).toBe("2212345");
  });

  it("reads every course row, including ones without a time", () => {
    expect(p.courses.map((c) => c.code)).toEqual(["BICS 4350", "BIIT 2301", "BICS 2304", "UNGS 1301", "ABCD 1000"]);
  });

  it("expands multi-day rows and continuation rows into slots", () => {
    expect(p.slots).toHaveLength(8);
    expect(p.slots.filter((s) => s.code === "BICS 2304")).toEqual([
      { code: "BICS 2304", section: "1", day: 2, start: "14:00", end: "15:20", venue: "ICT LR 3", lecturer: "DR. EXAMPLE THREE" },
      { code: "BICS 2304", section: "1", day: 4, start: "14:00", end: "15:20", venue: "ICT LAB 2", lecturer: "DR. EXAMPLE THREE" },
    ]);
  });

  it("returns a null semester label when the page has none", () => {
    expect(parseSchedule("<html><body></body></html>").sessionName).toBeNull();
  });

  it("returns no courses for a page without the table (e.g. the login page)", () => {
    expect(parseSchedule("<html><body><form id='fm1'></form></body></html>").courses).toEqual([]);
  });
});

describe.skipIf(!realHtml)("parseSchedule (real i-Ma'luum page)", () => {
  it("finds courses and sane slots", () => {
    const p = parseSchedule(realHtml);
    console.table(p.slots);
    console.log({ sessionName: p.sessionName, studentName: p.studentName, matric: p.matric });
    expect(p.courses.length).toBeGreaterThan(0);
    expect(p.slots.length).toBeGreaterThan(0);
    for (const s of p.slots) expect(s.start < s.end).toBe(true);
  });
});
