import type { Ore } from "../../domain/grades";
import { RANK_ART } from "./rankArt";

export type BadgeKind = Ore | "unrated";

export const ORE_COLOR: Record<BadgeKind, string> = {
  coal: "#8c919c", iron: "#dfe3e8", gold: "#f2b43a", emerald: "#3fd67a", diamond: "#56dcec", netherite: "#b07ce8", unrated: "#55585e",
};

export const ORE_NAME: Record<BadgeKind, string> = {
  coal: "Coal", iron: "Iron", gold: "Gold", emerald: "Emerald", diamond: "Diamond", netherite: "Netherite", unrated: "Unrated",
};

export const divLabel = (div: 1 | 2 | 3 | null) => (div ? "I".repeat(div) : "");

const GRID = 15;

/** One path per palette colour, each pixel a 1x1 square, centred on a 15x15 grid. */
const PATHS = Object.fromEntries(
  Object.entries(RANK_ART).map(([kind, { palette, rows }]) => {
    const dx = (GRID - rows[0].length) / 2;
    const dy = (GRID - rows.length) / 2;
    const d = palette.map(() => "");
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== ".") d[parseInt(ch, 36)] += `M${x + dx} ${y + dy}h1v1h-1z`;
    }));
    return [kind, palette.map((fill, i) => ({ fill, d: d[i] }))];
  }),
) as Record<string, { fill: string; d: string }[]>;

const LEAK: Partial<Record<Ore, [number, number]>> = { emerald: [0.08, 0.12], diamond: [0.13, 0.17], netherite: [0.2, 0.24] };

/** How strongly the rank's colour bleeds into the page: none below Emerald, a little more each ore and division. */
export function leakOf(ore: Ore, progress: number): number {
  const range = LEAK[ore];
  return range ? range[0] + (range[1] - range[0]) * Math.min(1, Math.max(0, progress)) : 0;
}

export function RankBadge({ kind, div, size = 96 }: { kind: BadgeKind; div?: 1 | 2 | 3 | null; size?: number }) {
  const artKey = kind === "diamond" && div === 3 ? "diamond3" : kind;
  return (
    <div class={`badge badge-${kind}`} style={{ "--rank": ORE_COLOR[kind], width: `${size}px`, height: `${size}px` }} aria-label={ORE_NAME[kind]}>
      <svg viewBox={`0 0 ${GRID} ${GRID}`} width={size} height={size} shape-rendering="crispEdges">
        {PATHS[artKey].map((p) => <path key={p.fill} fill={p.fill} d={p.d} />)}
      </svg>
    </div>
  );
}
