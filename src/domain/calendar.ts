/**
 * IIUM academic calendar (Gombak, Kuantan & Pagoh; all kulliyyahs except Medicine and Dentistry),
 * from the 527th Senate Meeting calendar for 2026/2027. Keyed by the label the slip parser builds.
 * Add the next session here when IIUM publishes it; unknown semesters fall back to a 14-week guess.
 */
export interface CalendarSemester {
  start: string; // first lecture day
  end: string; // last lecture day
  breaks: { from: string; to: string }[];
}

export const IIUM_CALENDAR: Record<string, CalendarSemester> = {
  "Sem 1, 2026/2027": { start: "2026-09-28", end: "2027-01-08", breaks: [{ from: "2026-11-14", to: "2026-11-22" }] },
  "Sem 2, 2026/2027": { start: "2027-02-22", end: "2027-06-04", breaks: [{ from: "2027-04-10", to: "2027-04-18" }] },
  "Sem 3, 2026/2027": { start: "2027-07-19", end: "2027-09-03", breaks: [] },
};
