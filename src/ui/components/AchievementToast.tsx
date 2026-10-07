import { useEffect, useRef, useState } from "preact/hooks";
import { ACHIEVEMENTS } from "../../domain/achievements";
import { useAppState } from "../../store/store";

/** Minecraft-style "Advancement Made!" for unlocks that happen while the app is open. */
export function AchievementToast() {
  const { achievements } = useAppState();
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    const ids = Object.keys(achievements);
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    fresh.forEach((id) => seen.current!.add(id));
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [achievements]);

  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 4000);
    return () => clearTimeout(t);
  }, [queue]);

  const a = ACHIEVEMENTS.find((x) => x.id === queue[0]);
  if (!a) return null;
  return (
    <div class={`adv-toast ${a.secret ? "secret" : ""}`} role="status" onClick={() => setQueue([])}>
      <small>{a.secret ? "Secret achievement" : "Achievement unlocked"}</small>
      <b>{a.name}</b>
    </div>
  );
}
