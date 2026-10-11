import type { JSX } from "preact";
import { BUM_ART } from "./achievementArt";

export { BUM_ART };

export interface PixelArtData {
  palette: string[];
  rows: string[];
}

/** 15x15 Emerald/Gold Guardian Shield for attendance cleared / caught up */
export const SHIELD_ART: PixelArtData = {
  palette: ["#0f2e1a", "#15803d", "#22c55e", "#4ade80", "#bbf7d0"],
  rows: [
    "....0000000....",
    "...011332210...",
    "..01334433210..",
    "..01344443210..",
    ".0133444433210.",
    ".0134444443210.",
    ".0133444433210.",
    ".0133444433210.",
    "..01334433210..",
    "..01334433210..",
    "...013443210...",
    "....0133210....",
    ".....01210.....",
    "......010......",
    ".......0.......",
  ],
};

/** 11x11 Academic Quest Scroll for task rows */
export const SCROLL_ART: PixelArtData = {
  palette: ["#2d2417", "#785324", "#d97706", "#fef3c7", "#fde68a"],
  rows: [
    "..00000....",
    ".03444300..",
    "0341114300.",
    "0414441430.",
    "0414111430.",
    "0414444430.",
    "0414111430.",
    "0414444430.",
    ".034444300.",
    "..03443020.",
    "...000000..",
  ],
};

/** 11x11 Crossed Swords for final exam tasks */
export const SWORD_ART: PixelArtData = {
  palette: ["#1e1b4b", "#4338ca", "#818cf8", "#e0e7ff", "#f59e0b", "#78350f"],
  rows: [
    "0.........0",
    ".03.....30.",
    "..032.230..",
    "...02320...",
    "....020....",
    "...04040...",
    "..040.040..",
    ".050...050.",
    "050.....050",
    ".0.......0.",
    "...........",
  ],
};

/** 9x9 Pixel Diamond Star for prestige indicators */
export const STAR_ART: PixelArtData = {
  palette: ["#3b2505", "#b45309", "#f59e0b", "#fde68a", "#ffffff"],
  rows: [
    "....0....",
    "...010...",
    "..01310..",
    ".0134310.",
    "013444310",
    ".0134310.",
    "..01310..",
    "...010...",
    "....0....",
  ],
};

export function PixelIcon({
  art,
  size = 15,
  className,
  style,
}: {
  art: PixelArtData;
  size?: number;
  className?: string;
  style?: JSX.CSSProperties;
}) {
  const h = art.rows.length;
  const w = art.rows[0]?.length ?? 0;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      shape-rendering="crispEdges"
      class={className}
      style={{ display: "inline-block", verticalAlign: "middle", flex: "none", ...style }}
    >
      {art.rows.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          const idx = parseInt(ch, 16);
          const color = art.palette[idx];
          if (!color) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />;
        })
      )}
    </svg>
  );
}
