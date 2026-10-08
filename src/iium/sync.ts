import { groupRows, parseSlip } from "./parser";
import type { ParsedSchedule } from "./parser";
import {
  imageFileToCanvas,
  isImageFile,
  isTextPdf,
  ocrPdf,
  recognizeCanvas,
  textToRows,
  type ProgressCallback,
} from "./ocr";
import { loadPdfDoc, textItems } from "./pdf";
import { parseResults } from "./results";
import type { ParsedResult } from "./results";

export class SyncError extends Error {}

/** Read the i-Ma'luum "Course Registration Confirmation Slip" PDF or image the user picked. */
export async function readSlip(
  file: Blob,
  onProgress?: ProgressCallback,
): Promise<ParsedSchedule> {
  let rows: string[][];

  if (isImageFile(file)) {
    try {
      onProgress?.("Loading image…");
      const canvas = await imageFileToCanvas(file);
      const text = await recognizeCanvas(canvas, onProgress);
      rows = textToRows(text);
    } catch (e) {
      throw new SyncError(`Failed to process image: ${(e as Error).message}`);
    }
  } else {
    let doc: any;
    try {
      doc = await loadPdfDoc(await file.arrayBuffer());
    } catch {
      throw new SyncError("Couldn't open that file. Pick the PDF or image of your Course Registration Confirmation Slip.");
    }

    try {
      const items = await textItems(doc);
      if (isTextPdf(items)) {
        rows = groupRows(items);
      } else {
        onProgress?.("Image-based PDF detected. Starting OCR…");
        const text = await ocrPdf(doc, onProgress);
        rows = textToRows(text);
      }
    } finally {
      if (doc?.destroy) void doc.destroy();
    }
  }

  const parsed = parseSlip(rows);
  if (parsed.courses.length === 0) {
    throw new SyncError("No courses found. In i-Ma'luum open the Course Registration Confirmation Slip, print it to PDF, then import that file.");
  }
  return parsed;
}

/** Read the i-Ma'luum Examination Result slip PDF or image the user picked. */
export async function readResultSlip(
  file: Blob,
  onProgress?: ProgressCallback,
): Promise<ParsedResult> {
  let rows: string[][];

  if (isImageFile(file)) {
    try {
      onProgress?.("Loading image…");
      const canvas = await imageFileToCanvas(file);
      const text = await recognizeCanvas(canvas, onProgress);
      rows = textToRows(text);
    } catch (e) {
      throw new SyncError(`Failed to process image: ${(e as Error).message}`);
    }
  } else {
    let doc: any;
    try {
      doc = await loadPdfDoc(await file.arrayBuffer());
    } catch {
      throw new SyncError("Couldn't open that file. Pick the PDF or image of your Examination Result slip.");
    }

    try {
      const items = await textItems(doc);
      if (isTextPdf(items)) {
        rows = groupRows(items);
      } else {
        onProgress?.("Image-based PDF detected. Starting OCR…");
        const text = await ocrPdf(doc, onProgress);
        rows = textToRows(text);
      }
    } finally {
      if (doc?.destroy) void doc.destroy();
    }
  }

  const parsed = parseResults(rows);
  if (!parsed) {
    throw new SyncError("That isn't a result slip. In i-Ma'luum open Examination Result for the semester, print it to PDF, then import that file.");
  }
  return parsed;
}
