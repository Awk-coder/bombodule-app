import { useState } from "preact/hooks";
import { ACHIEVEMENTS, progressOf } from "../../domain/achievements";
import type { Achievement } from "../../domain/achievements";
import { useAppState } from "../../store/store";
import { useNow } from "../useNow";
import { Sheet } from "./Sheet";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AchievementGrid() {
  const state = useAppState();
  const { achievements } = state;
  const now = useNow();
  const [open, setOpen] = useState<Achievement | null>(null);
  const got = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  const hidden = (a: Achievement) => a.secret && !achievements[a.id];
  const progress = open && !achievements[open.id] ? progressOf(state, now, open.id) : null;
  return (
    <>
      <h2 class="section-title">Achievements <span class="count">{got} / {ACHIEVEMENTS.length}</span></h2>
      <div class="adv-grid">
        {ACHIEVEMENTS.map((a) => (
          <button key={a.id} class={`adv ${achievements[a.id] ? "on" : ""} ${a.secret ? "secret" : ""}`} onClick={() => setOpen(a)}>
            <b>{hidden(a) ? "???" : a.name}</b>
            <small>{hidden(a) ? a.hint : a.desc}</small>
          </button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            <h2>{hidden(open) ? "Secret achievement" : open.name}</h2>
            <p>{hidden(open) ? `Hint: ${open.hint}` : open.desc}</p>
            {achievements[open.id] && <p class="group-hint">Unlocked {longDate(achievements[open.id])}</p>}
            {progress && (
              <>
                <div class="adv-progress"><span style={{ width: `${(progress[0] / progress[1]) * 100}%` }} /></div>
                <p class="group-hint">{progress[0]} / {progress[1]}</p>
              </>
            )}
            {!achievements[open.id] && !progress && <p class="group-hint">Locked</p>}
          </>
        )}
      </Sheet>
    </>
  );
}
