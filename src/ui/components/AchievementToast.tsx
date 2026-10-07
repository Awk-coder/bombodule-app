import { useEffect, useRef, useState } from "preact/hooks";
import { ACHIEVEMENTS } from "../../domain/achievements";
import { useAppState } from "../../store/store";
import { AchievementArt } from "./AchievementArt";

const SHOW_MS = 4000;
const LEGENDARY_MS = 7000;

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

  const a = ACHIEVEMENTS.find((x) => x.id === queue[0]);

  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), a?.tier === "legendary" ? LEGENDARY_MS : SHOW_MS);
    return () => clearTimeout(t);
  }, [queue]);

  if (!a) return null;
  const label = a.tier === "legendary" ? "Legendary achievement" : a.tier === "rare" ? "Rare achievement" : a.secret ? "Secret achievement" : "Achievement unlocked";
  return (
    <div key={a.id} class={`adv-toast ${a.secret ? "secret" : ""} ${a.tier ?? ""}`} role="status" onClick={() => setQueue([])}>
      <AchievementArt a={a} size={a.tier === "legendary" ? 64 : 20} />
      <div>
        <small>{label}</small>
        <b>{a.name}</b>
      </div>
    </div>
  );
}
