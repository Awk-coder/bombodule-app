import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";

const LOCK_PX = 8; // movement before we decide horizontal swipe vs vertical scroll
const FLY_MS = 180;

/** Card that commits on a horizontal swipe: right → onRight, left → onLeft. Vertical drags scroll the page. */
export function SwipeRow({ onRight, onLeft, children }: { onRight: () => void; onLeft: () => void; children: ComponentChildren }) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const drag = useRef<{ x: number; y: number; dx: number; mode: "pending" | "swipe" | "scroll" } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== "swipe") return;
    const width = card.current?.offsetWidth ?? 0;
    const threshold = Math.max(80, width * 0.3);
    setSettling(true);
    if (Math.abs(d.dx) < threshold) {
      setDx(0);
      return;
    }
    const right = d.dx > 0;
    setDx((right ? 1 : -1) * Math.max(width, 400));
    setTimeout(() => (right ? onRight() : onLeft()), FLY_MS);
  };

  return (
    <div class={`swipe ${dx > 0 ? "to-right" : dx < 0 ? "to-left" : ""}`}>
      <div class="swipe-under">
        <span>Attended</span>
        <span>Missed</span>
      </div>
      <div
        ref={card}
        class="row swipe-card"
        style={`transform:translateX(${dx}px);transition:${settling ? `transform ${FLY_MS}ms ease-out` : "none"}`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, dx: 0, mode: "pending" };
          setSettling(false);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.mode === "scroll") return;
          const mx = e.clientX - d.x;
          const my = e.clientY - d.y;
          if (d.mode === "pending") {
            if (Math.abs(mx) < LOCK_PX && Math.abs(my) < LOCK_PX) return;
            d.mode = Math.abs(mx) > Math.abs(my) ? "swipe" : "scroll";
            if (d.mode === "scroll") return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }
          d.dx = mx;
          setDx(mx);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          drag.current = null;
          setSettling(true);
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
