import { groupRows, parseSlip } from "./parser";
import type { ParsedSchedule } from "./parser";
import { readPdf } from "./pdf";

export class SyncError extends Error {}

/** Read the i-Ma'luum "Course Registration Confirmation Slip" PDF the user picked. */
export async function readSlip(file: Blob): Promise<ParsedSchedule> {
  let items;
  try {
    items = await readPdf(await file.arrayBuffer());
  } catch {
    throw new SyncError("Couldn't open that file. Pick the PDF of your Course Registration Confirmation Slip.");
  }
  const parsed = parseSlip(groupRows(items));
  if (parsed.courses.length === 0) {
    throw new SyncError("No courses found. In i-Ma'luum open the Course Registration Confirmation Slip, print it to PDF, then import that file.");
  }
  return parsed;
}
