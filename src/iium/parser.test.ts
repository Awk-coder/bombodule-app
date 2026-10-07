/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupRows, parseDays, parseSlip, parseTimeRange } from "./parser";

const REAL = "tests/fixtures/real-slip.pdf";

describe("parseDays", () => {
  it.each([
    ["M-W", [1, 3]],
    ["T-TH", [2, 4]],
    ["MON - WED", [1, 3]],
    ["MON", [1]],
    ["TH", [4]],
    ["F", [5]],
    ["SAT", [6]],
    ["-", []],
  ] as const)("%s", (text, days) => expect(parseDays(text)).toEqual(days));
});

describe("parseTimeRange", () => {
  it.each([
    ["8.30 - 9.50 AM", ["08:30", "09:50"]],
    ["10.00 - 11.20 AM", ["10:00", "11:20"]],
    ["2.00 - 3.20 PM", ["14:00", "15:20"]],
    ["2.00 - 3.50 PM", ["14:00", "15:50"]],
    ["11.30 - 12.50 PM", ["11:30", "12:50"]],
    ["11.30 - 12.50 AM", ["11:30", "12:50"]], // the slip prints noon-crossing classes either way
    ["12.00 - 1.20 PM", ["12:00", "13:20"]],
  ] as const)("%s", (text, range) => expect(parseTimeRange(text)).toEqual(range));

  it("rejects junk", () => {
    expect(parseTimeRange("TBA")).toBeNull();
    expect(parseTimeRange("-")).toBeNull();
  });
});

describe("groupRows", () => {
  it("groups text by line, top to bottom, left to right, dropping blanks", () => {
    const rows = groupRows([
      { str: "PM", x: 404, y: 608 },
      { str: "BICS 1000", x: 59, y: 608 },
      { str: "Name", x: 63, y: 651 },
      { str: " ", x: 90, y: 651 },
      { str: "- 12.50", x: 377, y: 607.6 },
    ]);
    expect(rows).toEqual([["Name"], ["BICS 1000", "- 12.50", "PM"]]);
  });
});

const slip = (...courseRows: string[][]): string[][] => [
  ["Printed by 1234567 on", "01-Oct-2026, 08:00 pm"],
  ["International Islamic University Malaysia"],
  ["Course Registration Confirmation Slip"],
  ["Session : 2026/2027", "Semester : 1"],
  ["Matric No", ":", "1234567", "IC/Passport No.: X0000000", "Program", ":", "BCS1"],
  ["Name", ":", "SITI EXAMPLE", "Level", ":", "2"],
  ["Course", "Sec", "Sta", "Title", "Chr", "Day", "Time", "Venue"],
  ...courseRows,
  ["Total", "20"],
];

describe("parseSlip", () => {
  it("reads semester, name and matric from the header", () => {
    const p = parseSlip(slip());
    expect(p.sessionName).toBe("Sem 1, 2026/2027");
    expect(p.studentName).toBe("SITI EXAMPLE");
    expect(p.matric).toBe("1234567");
  });

  it("reads course rows and expands multi-day rows into slots", () => {
    const p = parseSlip(slip(
      ["BICS 1001", "2", "R", "Data Structures 2", "3", "T-TH", "2.00", "- 3.20", "PM", "ICT LR 14A LEVEL 2D"],
      ["UNGS 2290", "1", "R", "KNOWLEDGE & CIVILIZATION IN ISLAM", "2", "MON", "11.30", "- 12.50", "AM", "IRK LR 12 3.71"],
    ));
    expect(p.courses).toEqual([
      { code: "BICS 1001", name: "Data Structures 2", section: "2", credits: 3 },
      { code: "UNGS 2290", name: "KNOWLEDGE & CIVILIZATION IN ISLAM", section: "1", credits: 2 },
    ]);
    expect(p.slots).toEqual([
      { code: "BICS 1001", section: "2", day: 2, start: "14:00", end: "15:20", venue: "ICT LR 14A LEVEL 2D", lecturer: "" },
      { code: "BICS 1001", section: "2", day: 4, start: "14:00", end: "15:20", venue: "ICT LR 14A LEVEL 2D", lecturer: "" },
      { code: "UNGS 2290", section: "1", day: 1, start: "11:30", end: "12:50", venue: "IRK LR 12 3.71", lecturer: "" },
    ]);
  });

  it("keeps a course without a time and attaches continuation rows to the course above", () => {
    const p = parseSlip(slip(
      ["BICS 1002", "1", "R", "Networks", "3", "M-W", "8.30", "- 9.50", "AM", "ICT LR 1"],
      ["F", "2.00", "- 4.50", "PM", "ICT LAB 2"],
      ["UNGS 1001", "3", "R", "Online Course", "2"],
    ));
    expect(p.courses.map((c) => c.code)).toEqual(["BICS 1002", "UNGS 1001"]);
    expect(p.slots.filter((s) => s.code === "BICS 1002").map((s) => [s.day, s.start, s.venue])).toEqual([
      [1, "08:30", "ICT LR 1"],
      [3, "08:30", "ICT LR 1"],
      [5, "14:00", "ICT LAB 2"],
    ]);
    expect(p.slots.some((s) => s.code === "UNGS 1001")).toBe(false);
  });

  it("finds nothing in an unrelated document", () => {
    const p = parseSlip([["Hello"], ["Some other PDF"]]);
    expect(p).toEqual({ sessionName: null, studentName: null, matric: null, courses: [], slots: [] });
  });
});

describe.skipIf(!existsSync(REAL))("real confirmation slip PDF", () => {
  it("parses every course with sane times", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { textItems } = await import("./pdf");
    const doc = await getDocument({ data: new Uint8Array(readFileSync(REAL)) }).promise;
    const p = parseSlip(groupRows(await textItems(doc)));
    expect(p.sessionName).toMatch(/^Sem \d, \d{4}\/\d{4}$/);
    expect(p.matric).toMatch(/^\d{7}$/);
    expect(p.studentName).toBeTruthy();
    expect(p.courses.length).toBeGreaterThan(0);
    for (const c of p.courses) expect(p.slots.some((s) => s.code === c.code)).toBe(true);
    for (const s of p.slots) {
      expect(s.start >= "07:00" && s.end <= "23:00" && s.start < s.end).toBe(true);
    }
  });
});
