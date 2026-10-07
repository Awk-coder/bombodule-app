/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupRows } from "./parser";
import { parseResults } from "./results";

const REAL = "tests/fixtures/real-result.pdf";

// Rows as pdf.js + groupRows produce them from a real slip; personal lines replaced.
const SLIP: string[][] = [
  ["Print"],
  ["07-OCT-2026 11:56 AM", "INTERNATIONAL ISLAMIC UNIVERSITY MALAYSIA", "Subject to Senate's"],
  ["EXAMINATION RESULT", "Endorsement"],
  ["SESSION : 2025/2026 SEMESTER : 2"],
  ["NAME", ": SITI EXAMPLE", "MATRIC NO", ": 1234567"],
  ["PROGRAM", ": BACHELOR IN COMPUTER SCIENCE (HONOURS)"],
  ["MAJOR", ":", "IC/PSPT NO", ": X0000000"],
  ["SPONSOR", ":", "LEVEL", ": 2"],
  ["Code", "Course Title", "Chr", "Grade", "Point", "Q Point"],
  ["BICS 2304", "Computer Architecture & Assembly Language", "3", "F", ".00", ".00"],
  ["BICS 4336", "BLOCKCHAIN AND APPLICATION", "3", "A-", "3.67", "11.01"],
  ["BICS 4340", "Machine Learning", "3", "C+", "2.33", "6.99"],
  ["BICS 4350", "Privacy Engineering", "3", "B-", "2.67", "8.01"],
  ["BIIT 2301", "User Experience Design", "3", "D", "1.67", "5.01"],
  ["EECE 1313", "PROGRAMMING FOR ENGINEERS", "3", "E", "1.00", "3.00"],
  ["UNGS 1301", "BASIC PHILOSOPHY AND ISLAMIC WORLDVIEW", "3", "C+", "2.33", "6.99"],
  ["TOTAL CREDIT POINTS", ": 41.01", "CUMMULATIVE GRADE POINTS", ": 173.99"],
  ["TOTAL CREDIT HOURS", ": 21", "CUMMULATIVE CREDIT HOURS", ": 68.5"],
  ["GRADE POINT AVERAGE(GPA)", ": 1.95", "CGPA", ": 2.54"],
  ["STATUS", ":", "COND. PASS"],
  ["REMARKS", ":", "RPT.BIIT 2301,EECE 1313,BICS 2304"],
  ["KEY", ":"],
  ["EX", "-", "exemption", "I", "-", "incomplete", "PA", "-", "pass", "course"],
  ["80", "-", "100", "A", "4.00", "Excellent"],
];

describe("parseResults", () => {
  it("reads semester, courses, totals, status", () => {
    const r = parseResults(SLIP)!;
    expect(r.label).toBe("Sem 2, 2025/2026");
    expect(r.courses).toHaveLength(7);
    expect(r.courses[0]).toEqual({ code: "BICS 2304", title: "Computer Architecture & Assembly Language", credits: 3, grade: "F", point: 0 });
    expect(r.courses[1].grade).toBe("A-");
    expect(r.printed).toEqual({ gpa: 1.95, cgpa: 2.54, credits: 21, cumCredits: 68.5, cumPoints: 173.99 });
    expect(r.status).toBe("COND. PASS");
    expect(r.remarks).toBe("RPT.BIIT 2301,EECE 1313,BICS 2304");
  });

  it("never carries personal details", () => {
    const text = JSON.stringify(parseResults(SLIP));
    for (const s of ["SITI", "1234567", "X0000000"]) expect(text).not.toContain(s);
  });

  it("reads grades without points", () => {
    const rows = SLIP.map((r) => (r[0] === "BICS 4340" ? ["BICS 4340", "Machine Learning", "3", "W"] : r));
    expect(parseResults(rows)!.courses[2]).toEqual({ code: "BICS 4340", title: "Machine Learning", credits: 3, grade: "W", point: null });
  });

  it("rejects other documents, including the timetable slip", () => {
    expect(parseResults([["Hello"]])).toBeNull();
    expect(parseResults([["Session : 2026/2027", "Semester : 1"], ["BICS 4350", "1", "R", "PRIVACY ENGINEERING", "3", "M-W", "11.30 - 12.50 PM", "ICT LR 14"]])).toBeNull();
  });
});

describe.skipIf(!existsSync(REAL))("real result slip PDF", () => {
  it("parses with matching totals", async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { textItems } = await import("./pdf");
    const doc = await getDocument({ data: new Uint8Array(readFileSync(REAL)) }).promise;
    const r = parseResults(groupRows(await textItems(doc)))!;
    expect(r.label).toMatch(/^Sem \d, \d{4}\/\d{4}$/);
    expect(r.courses.reduce((n, c) => n + c.credits, 0)).toBe(r.printed.credits);
  });
});
