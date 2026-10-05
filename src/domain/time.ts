const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function atTime(date: string, time: string): Date {
  const d = parseYmd(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
