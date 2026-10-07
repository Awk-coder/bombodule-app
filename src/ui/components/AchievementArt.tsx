import type { Achievement } from "../../domain/achievements";
import { LEGENDARY_ART, RARE_ART } from "./achievementArt";
import type { PixelArt } from "./achievementArt";

/** One path per palette colour, each pixel a 1x1 square, centred on a square grid. */
function Pixels({ art, size }: { art: PixelArt; size: number }) {
  const grid = Math.max(art.rows.length, art.rows[0].length);
  const dx = (grid - art.rows[0].length) / 2;
  const dy = (grid - art.rows.length) / 2;
  const d = art.palette.map(() => "");
  art.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== ".") d[parseInt(ch, 36)] += `M${x + dx} ${y + dy}h1v1h-1z`;
  }));
  return (
    <svg class="adv-art" viewBox={`0 0 ${grid} ${grid}`} width={size} height={size} shape-rendering="crispEdges" aria-hidden="true">
      {art.palette.map((fill, i) => <path key={fill} fill={fill} d={d[i]} />)}
    </svg>
  );
}

/** The rare mark or the legendary piece; nothing for normal achievements. */
export function AchievementArt({ a, size }: { a: Achievement; size: number }) {
  const art = a.tier === "legendary" ? LEGENDARY_ART[a.id] : a.tier === "rare" ? RARE_ART : null;
  return art ? <Pixels art={art} size={size} /> : null;
}
