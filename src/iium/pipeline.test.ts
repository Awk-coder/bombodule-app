/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readResultSlip } from "./sync";

describe("hyper-reliable input pipeline fixtures", () => {
  it("parses accepted PDF (text-based)", async () => {
    const buf = readFileSync("tests/fixtures/accepted-result.pdf");
    const blob = new Blob([buf], { type: "application/pdf" });
    const r = await readResultSlip(blob);
    expect(r.label).toBe("Sem 1, 2025/2026");
    expect(r.courses).toHaveLength(6);
    expect(r.printed.gpa).toBe(3.1);
    expect(r.printed.credits).toBe(17);
    expect(r.warnings ?? []).toHaveLength(0);
  });

  it("parses Chrome PDF (individual token cells)", async () => {
    const buf = readFileSync("tests/fixtures/chrome-result.pdf");
    const blob = new Blob([buf], { type: "application/pdf" });
    const r = await readResultSlip(blob);
    expect(r.label).toBe("Sem 1, 2024/2025");
    expect(r.courses).toHaveLength(6);
    expect(r.printed.gpa).toBe(3.21);
    expect(r.printed.credits).toBe(13);
    expect(r.warnings ?? []).toHaveLength(0);
  });

  it("parses iOS image-based PDF via OCR pipeline", async () => {
    const buf = readFileSync("tests/fixtures/ios-image-result.pdf");
    const blob = new Blob([buf], { type: "application/pdf" });
    const progressLog: string[] = [];
    const r = await readResultSlip(blob, (msg) => progressLog.push(msg));
    expect(r.label).toBe("Sem 1, 2024/2025");
    expect(r.courses.length).toBeGreaterThanOrEqual(5);
    expect(r.printed.gpa).toBe(3.21);
    expect(r.printed.credits).toBe(13);
    expect(progressLog.length).toBeGreaterThan(0);
  }, 30_000);

  it("parses direct screenshot image (PNG)", async () => {
    const buf = readFileSync("tests/fixtures/screenshot-result.png");
    const blob = new Blob([buf], { type: "image/png" });
    const r = await readResultSlip(blob);
    expect(r.label).toBe("Sem 1, 2024/2025");
    expect(r.courses.length).toBeGreaterThanOrEqual(5);
    expect(r.printed.gpa).toBe(3.21);
    expect(r.printed.credits).toBe(13);
  }, 30_000);
});
