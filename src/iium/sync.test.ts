import { describe, expect, it, vi } from "vitest";
import type { TextItem } from "./parser";

let result: TextItem[] | Error = [];
vi.mock("./pdf", () => ({
  loadPdfDoc: async () => {
    if (result instanceof Error) throw result;
    return {
      numPages: 1,
      getPage: async () => ({
        render: () => ({ promise: Promise.resolve() }),
        getViewport: () => ({ width: 100, height: 100 }),
      }),
      destroy: async () => {},
    };
  },
  textItems: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
  readPdf: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
}));

vi.mock("./ocr", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./ocr")>();
  return {
    ...mod,
    ocrPdf: async () => "",
  };
});

const { SyncError, readSlip } = await import("./sync");
const row = (y: number, ...cells: string[]): TextItem[] => cells.map((str, i) => ({ str, x: i * 10, y }));
const file = new Blob(["%PDF"]);

describe("readSlip", () => {
  it("returns the parsed timetable", async () => {
    result = [
      ...row(700, "Session : 2026/2027", "Semester : 1"),
      ...row(600, "BICS 1001", "2", "R", "Data Structures", "3", "M-W", "8.30", "- 9.50", "AM", "ICT LR 1"),
    ];
    const p = await readSlip(file);
    expect(p.sessionName).toBe("Sem 1, 2026/2027");
    expect(p.slots).toHaveLength(2);
  });

  it("explains when the PDF has no courses", async () => {
    result = row(700, "Some other document");
    await expect(readSlip(file)).rejects.toThrow(/No courses found/);
  });

  it("explains when the file isn't a readable PDF", async () => {
    result = new Error("Invalid PDF structure");
    const err = await readSlip(file).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect((err as Error).message).toMatch(/Couldn't open that file/);
  });
});
