import { parseYmd } from "../domain/time";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dayName = (d: number) => DAYS[d];

export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtDate(ymdStr: string): string {
  const d = parseYmd(ymdStr);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function relDue(due: Date, now: Date): string {
  const mins = Math.round((due.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(mins);
  const span = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins < 0 ? `overdue ${span}` : `in ${span}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}

export const minutesLeft = (end: Date, now: Date) => Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 60_000));

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const firstTwo = (name: string) => name.trim().split(/\s+/).slice(0, 2);

export const shortName = (name: string) => titleCase(firstTwo(name).join(" "));

export const initials = (name: string | null | undefined) =>
  name ? firstTwo(name).map((w) => w[0].toUpperCase()).join("") : "?";
