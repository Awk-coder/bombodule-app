import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Hadir } from "../native/hadir";
import { parseSchedule } from "./parser";
import type { ParsedSchedule } from "./parser";

export const SCHEDULE_URL = "https://imaluum.iium.edu.my/MyAcademic/schedule";
export const CANCELLED = "cancelled";

export class SyncError extends Error {
  constructor(message: string, readonly html?: string) {
    super(message);
  }
}

async function fetchScheduleHtml(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return (await import("../../tests/fixtures/schedule.html?raw")).default;
  }
  const { cookie } = await Hadir.casLogin(); // rejects with "cancelled" if the user backs out
  try {
    const res = await CapacitorHttp.get({ url: SCHEDULE_URL, headers: { Cookie: cookie }, responseType: "text" });
    if (res.status !== 200) throw new SyncError(`i-Ma'luum returned HTTP ${res.status}`);
    return String(res.data);
  } finally {
    await Hadir.clearCookies();
  }
}

export async function fetchTimetable(): Promise<ParsedSchedule> {
  const html = await fetchScheduleHtml();
  const parsed = parseSchedule(html);
  if (parsed.courses.length === 0) throw new SyncError("Couldn't read your timetable from i-Ma'luum", html);
  return parsed;
}
