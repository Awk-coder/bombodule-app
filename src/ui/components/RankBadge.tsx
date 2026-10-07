import type { Ore } from "../../domain/grades";

export type BadgeKind = Ore | "unrated";

export const BADGES: Record<BadgeKind, string[]> = {
  coal: [
    "...............",
    ".......o.......",
    "......oao......",
    "......oao......",
    ".....oabao.....",
    ".....oacao.....",
    "....oabcbao....",
    "....oacwcao....",
    "....oabcbao....",
    ".....oacao.....",
    ".....oabao.....",
    "......oao......",
    "......oao......",
    ".......o.......",
    "...............",
  ],
  iron: [
    "...............",
    ".......o.......",
    "......obo......",
    ".....obcbo.....",
    "....obcwcbo....",
    "...obccwccbo...",
    "..oabccwccbao..",
    ".oabbcwwwcbbao.",
    "..oabccwccbao..",
    "...oabcccbao...",
    "....oabcbao....",
    ".....oabao.....",
    "......oao......",
    ".......o.......",
    "...............",
  ],
  gold: [
    "...............",
    ".......o.......",
    "......oco......",
    "......obo......",
    ".....obcbo.....",
    "....obcwcbo....",
    ".ooobccwccbooo.",
    "oacbbcwwwcbbcao",
    ".ooobccwccbooo.",
    "....obcwcbo....",
    ".....obcbo.....",
    "......obo......",
    "......oco......",
    ".......o.......",
    "...............",
  ],
  emerald: [
    ".......o.......",
    "..o...oco...o..",
    ".oco..obo..oco.",
    "..obo.obo.obo..",
    "...obobcbobo...",
    "....obcwcbo....",
    ".oobbcwwwcbboo.",
    "ocbbcwwwwwcbbco",
    ".oobbcwwwcbboo.",
    "....obcwcbo....",
    "...obobcbobo...",
    "..obo.obo.obo..",
    ".oco..obo..oco.",
    "..o...oco...o..",
    ".......o.......",
  ],
  diamond: [
    "...............",
    "...............",
    "....ooooooo....",
    "...obcwwwcbo...",
    "..obccwwwccbo..",
    ".obbcccwcccbbo.",
    "oaabbbbbbbbbaao",
    ".oabbcccccbbao.",
    "..oabbcccbbao..",
    "...oabbcbbao...",
    "....oabbbao....",
    ".....oabao.....",
    "......oao......",
    ".......o.......",
    "...............",
  ],
  netherite: [
    "...............",
    ".o....o.o....o.",
    "..o..obobo..o..",
    "...oobcccboo...",
    "..obcccwcccbo..",
    ".obcccwwwcccbo.",
    ".obccwwwwwccbo.",
    "oobccwwwwwccboo",
    ".obccwwwwwccbo.",
    ".obcccwwwcccbo.",
    "..obcccwcccbo..",
    "...oobcccboo...",
    "..o..obobo..o..",
    ".o....o.o....o.",
    "...............",
  ],
  unrated: [
    ".......o.......",
    "......obo......",
    ".....obbbo.....",
    "....obwwwbo....",
    "...obwbbbwbo...",
    "..obbbbbbwbbo..",
    ".obbbbbbwbbbbo.",
    "obbbbbbwbbbbbbo",
    ".obbbbbbbbbbbo.",
    "..obbbbwbbbbo..",
    "...obbbbbbbo...",
    "....obbbbbo....",
    ".....obbbo.....",
    "......obo......",
    ".......o.......",
  ],
};

const PALETTES: Record<BadgeKind, Record<string, string>> = {
  coal: { o: "#0e0e12", a: "#23232b", b: "#3b3d4a", c: "#5a5e70", w: "#8a90a6" },
  iron: { o: "#10181a", a: "#4c5a5c", b: "#9fb2b0", c: "#d4e2df", w: "#ffffff" },
  gold: { o: "#4a2a00", a: "#a55a00", b: "#e39b10", c: "#ffd23a", w: "#fff6a8" },
  emerald: { o: "#06330f", a: "#128a2c", b: "#2fcf55", c: "#8ff2a4", w: "#e6ffe9" },
  diamond: { o: "#0a3a40", a: "#138f96", b: "#2ed3d0", c: "#8af5ec", w: "#e8fffd" },
  netherite: { o: "#1a0f22", a: "#3a2350", b: "#6b3d8f", c: "#b25fd6", w: "#f0b3ff" },
  unrated: { o: "#000000", a: "#111111", b: "#2a2a2a", c: "#555555", w: "#ffffff" },
};

export const ORE_COLOR: Record<BadgeKind, string> = {
  coal: "#9a9fab", iron: "#ffffff", gold: "#ffaa00", emerald: "#55ff55", diamond: "#55ffff", netherite: "#c45cff", unrated: "#bbbbbb",
};

export const ORE_NAME: Record<BadgeKind, string> = {
  coal: "Coal", iron: "Iron", gold: "Gold", emerald: "Emerald", diamond: "Diamond", netherite: "Netherite", unrated: "Unrated",
};

export const divLabel = (div: 1 | 2 | 3 | null) => (div ? "I".repeat(div) : "");

export function RankBadge({ kind, size = 96 }: { kind: BadgeKind; size?: number }) {
  const pal = PALETTES[kind];
  return (
    <svg class={`badge badge-${kind}`} width={size} height={size} viewBox="0 0 15 15" shape-rendering="crispEdges" aria-label={ORE_NAME[kind]}>
      {BADGES[kind].flatMap((row, y) => [...row].map((ch, x) => (ch === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={pal[ch]} />)))}
    </svg>
  );
}
