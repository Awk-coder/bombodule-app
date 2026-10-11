import { seasonElo } from "./elo";
import { labelKey, rankOf } from "./grades";
import type { Ore } from "./grades";
import type { AppState } from "./types";

export interface Title {
  id: string; // the achievement id, or "rank-diamond" / "rank-netherite"
  text: string;
}

/** Hand-picked achievements that unlock a title. */
const ACHIEVEMENT_TITLES: Title[] = [
  { id: "flawless", text: "Mr Perfect" },
  { id: "perfect-record", text: "The One and Only" },
  { id: "top-of-the-class", text: "Top of the Class" },
  { id: "overpowered", text: "Dean's Lister" },
  { id: "serious-dedication", text: "Ever Present" },
  { id: "monsters-hunted", text: "Monster Slayer" },
  { id: "speedrun", text: "Speedrunner" },
  { id: "redemption-arc", text: "Redeemed" },
  { id: "back-from-the-brink", text: "Comeback Kid" },
  { id: "not-today", text: "Living on the Edge" },
  { id: "voluntary-exile", text: "Exiled" },
  { id: "balanced-diet", text: "Grade Collector" },
  { id: "lock-in", text: "Needs to Lock In" },
  { id: "fasting-scholar", text: "Fasting Scholar" },
  { id: "next-generation", text: "Graduate" },
  { id: "master-baker", text: "Master Baker" },
  { id: "gordons-protege", text: "Gordon's Protege" },
];

const RANK_TITLES: (Title & { ore: Ore })[] = [
  { id: "rank-diamond", text: "Diamond Hands", ore: "diamond" },
  { id: "rank-netherite", text: "Netherite Grinder", ore: "netherite" },
];

const ORDER: Ore[] = ["coal", "iron", "gold", "emerald", "diamond", "netherite"];
const atLeast = (ore: Ore | undefined, min: Ore) => !!ore && ORDER.indexOf(ore) >= ORDER.indexOf(min);

/** Every title text a player may show, for the server to check against. */
export const TITLE_TEXTS: string[] = [...ACHIEVEMENT_TITLES.map((t) => t.text), ...RANK_TITLES.flatMap((t) => [t.text, `Fallen ${t.text}`])];

/** Notes the highest season rank reached this semester; same object when nothing changed. */
export function recordPeak(state: AppState, now: Date): AppState {
  const label = state.semester?.label;
  const season = seasonElo(state, now);
  if (!label || !season.rated) return state;
  const ore = rankOf(season.elo).ore;
  const prev = state.rankPeaks[label];
  if (prev && ORDER.indexOf(prev) >= ORDER.indexOf(ore)) return state;
  return { ...state, rankPeaks: { ...state.rankPeaks, [label]: ore } };
}

export function unlockedTitles(state: AppState): Title[] {
  const peaks = Object.values(state.rankPeaks);
  return [
    ...ACHIEVEMENT_TITLES.filter((t) => state.achievements[t.id]),
    ...RANK_TITLES.filter((t) => peaks.some((p) => atLeast(p, t.ore))).map(({ id, text }) => ({ id, text })),
  ];
}

/**
 * The title as shown, or null when it isn't unlocked. A rank title reads plainly through the
 * semester it was reached and the one after; past that it is "Fallen" until the rank is reached again.
 */
export function titleText(state: AppState, id: string): string | null {
  const t = unlockedTitles(state).find((x) => x.id === id);
  if (!t) return null;
  const rank = RANK_TITLES.find((x) => x.id === id);
  if (!rank) return t.text;
  const current = state.semester?.label;
  const earlier = Object.keys(state.rankPeaks)
    .filter((l) => !current || labelKey(l) < labelKey(current))
    .sort((a, b) => labelKey(a).localeCompare(labelKey(b)));
  const recent = [current, earlier.at(-1)].filter((l): l is string => !!l);
  return recent.some((l) => atLeast(state.rankPeaks[l], rank.ore)) ? t.text : `Fallen ${t.text}`;
}
