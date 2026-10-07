import { useEffect, useRef, useState } from "preact/hooks";
import { ACHIEVEMENTS } from "../../domain/achievements";
import { useAppState } from "../../store/store";
import { AchievementArt } from "./AchievementArt";

const SHOW_MS = { normal: 4000, rare: 6000, legendary: 8000 };
const EXIT_MS = 400; // matches the toast-out animation

const replayers = new Set<(id: string) => void>();

/** Shows an achievement's notification again. Display only: nothing is unlocked or saved. */
export const replayToast = (id: string) => replayers.forEach((r) => r(id));

/** Minecraft-style "Advancement Made!" for unlocks that happen while the app is open. */
export function AchievementToast() {
  const { achievements } = useAppState();
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [leaving, setLeaving] = useState<"one" | "all" | null>(null);
  const [shown, setShown] = useState(0); // bumps per toast, so a repeat slides in afresh

  useEffect(() => {
    const replay = (id: string) => setQueue((q) => [...q, id]);
    replayers.add(replay);
    return () => void replayers.delete(replay);
  }, []);

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
    if (!queue.length || leaving) return;
    const t = setTimeout(() => setLeaving("one"), SHOW_MS[a?.tier ?? "normal"]);
    return () => clearTimeout(t);
  }, [queue, leaving]);

  // Slide out the way it came in, then show the next one.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => {
      setQueue((q) => (leaving === "all" ? [] : q.slice(1)));
      setLeaving(null);
      setShown((n) => n + 1);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!a) return null;
  const label = a.tier === "legendary" ? "Legendary achievement" : a.tier === "rare" ? "Rare achievement" : a.secret ? "Secret achievement" : "Achievement unlocked";
  return (
    <div key={shown} class={`adv-toast ${a.secret ? "secret" : ""} ${a.tier ?? ""} ${leaving ? "leaving" : ""}`} role="status" onClick={() => setLeaving("all")}>
      <AchievementArt a={a} size={a.tier === "legendary" ? 64 : 20} />
      <div>
        <small>{label}</small>
        <b>{a.name}</b>
      </div>
    </div>
  );
}
