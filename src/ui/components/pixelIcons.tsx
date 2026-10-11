import type { JSX } from "preact";
import { BUM_ART, RARE_ART } from "./achievementArt";

export { BUM_ART, RARE_ART };

export interface PixelArtData {
  palette: string[];
  rows: string[];
}

/** 7x9 Pixel Lightning Bolt (strictly 2px/pixel -> 14x18px) */
export const LIGHTNING_ART: PixelArtData = {
  palette: ["#854d0e", "#f59e0b", "#fef08a"],
  rows: [
    "....00.",
    "...020.",
    "..0210.",
    ".021000",
    "0211110",
    "...0210",
    "..0210.",
    ".020...",
    ".00....",
  ],
};

/** 7x9 Pixel Flame (strictly 2px/pixel -> 14x18px) */
export const FLAME_ART: PixelArtData = {
  palette: ["#7c2d12", "#ea580c", "#fbbf24"],
  rows: [
    "...0...",
    "..010..",
    ".0120..",
    ".01210.",
    "0122210",
    "0122210",
    "0112110",
    ".01110.",
    "..000..",
  ],
};

/** 15x15 Emerald/Gold Guardian Shield (strictly 2px/pixel -> 30x30px) */
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

/** 7x9 Compact Shield for mechanics row (strictly 2px/pixel -> 14x18px) */
export const MINI_SHIELD_ART: PixelArtData = {
  palette: ["#0f2e1a", "#15803d", "#4ade80"],
  rows: [
    ".00000.",
    "0112110",
    "0122210",
    "0122210",
    "0122210",
    ".01210.",
    ".01210.",
    "..010..",
    "...0...",
  ],
};

/** 8x8 Pixel Book for academic overload (strictly 2px/pixel -> 16x16px) */
export const BOOK_ART: PixelArtData = {
  palette: ["#1e1b4b", "#4338ca", "#a5b4fc"],
  rows: [
    ".00..00.",
    "01100110",
    "01211210",
    "01211210",
    "01211210",
    "01211210",
    "01100110",
    ".00..00.",
  ],
};

/** 7x9 Pixel Hourglass for short semesters (strictly 2px/pixel -> 14x18px) */
export const HOURGLASS_ART: PixelArtData = {
  palette: ["#374151", "#9ca3af", "#f3f4f6"],
  rows: [
    "0000000",
    ".01210.",
    "..010..",
    "...0...",
    "..010..",
    ".01210.",
    ".01210.",
    "0122210",
    "0000000",
  ],
};

/** 9x9 Pixel Warning Triangle (strictly 2px/pixel -> 18x18px) */
export const WARN_ART: PixelArtData = {
  palette: ["#78350f", "#f59e0b", "#fef08a"],
  rows: [
    "....0....",
    "...010...",
    "..01210..",
    "..01210..",
    ".0112110.",
    ".0110110.",
    "011121110",
    "011000110",
    "000000000",
  ],
};

/** 11x11 Crossed Swords for final exam tasks (strictly 2px/pixel -> 22x22px) */
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

/**
 * Uniform PixelArt Component.
 * Pixel sizes are strictly constrained to 2 sizes for uniformity:
 * - scale 2: Micro scale (2px per art pixel)
 * - scale 12: Hero scale (12px per art pixel, matching Ranked Badge and 12px shader)
 */
export function PixelIcon({
  art,
  scale = 2,
  className,
  style,
}: {
  art: PixelArtData;
  scale?: 2 | 12;
  className?: string;
  style?: JSX.CSSProperties;
}) {
  const h = art.rows.length;
  const w = art.rows[0]?.length ?? 0;
  const pixelSize = scale;
  const widthPx = w * pixelSize;
  const heightPx = h * pixelSize;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={widthPx}
      height={heightPx}
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
