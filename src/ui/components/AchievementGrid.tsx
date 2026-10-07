import { useState } from "preact/hooks";
import { ACHIEVEMENTS, progressOf } from "../../domain/achievements";
import type { Achievement } from "../../domain/achievements";
import { useAppState } from "../../store/store";
import { useNow } from "../useNow";
import { AchievementArt } from "./AchievementArt";
import { replayToast } from "./AchievementToast";
import { Sheet } from "./Sheet";

const SHOWN = 8;

const TIER_NAME = { rare: "Rare", legendary: "Legendary" };

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AchievementGrid() {
  const state = useAppState();
  const { achievements } = state;
  const now = useNow();
  const [open, setOpen] = useState<Achievement | null>(null);
  const [all, setAll] = useState(false);
  const got = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  const hidden = (a: Achievement) => a.secret && !achievements[a.id];
  const progress = open && !achievements[open.id] ? progressOf(state, now, open.id) : null;
  // Unlocked first, newest first; locked ones keep their list order.
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (achievements[b.id] ?? "").localeCompare(achievements[a.id] ?? ""));
  return (
    <>
      <h2 class="section-title">Achievements <span class="count">{got} / {ACHIEVEMENTS.length}</span></h2>
      <div class="adv-grid">
        {sorted.slice(0, all ? undefined : SHOWN).map((a) => (
          <button key={a.id} class={`adv ${achievements[a.id] ? `on ${a.tier ?? ""}` : ""} ${a.secret ? "secret" : ""}`} onClick={() => setOpen(a)}>
            {achievements[a.id] && <AchievementArt a={a} size={a.tier === "legendary" ? 36 : 14} />}
            <b>{hidden(a) ? "???" : a.name}</b>
            <small>{hidden(a) ? a.hint : a.desc}</small>
          </button>
        ))}
      </div>
      <button class="link adv-more" onClick={() => setAll(!all)}>{all ? "Show less" : `Show all ${ACHIEVEMENTS.length}`}</button>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            {achievements[open.id] && open.tier && (
              <div class={`adv-sheet-art ${open.tier}`}>
                <AchievementArt a={open} size={open.tier === "legendary" ? 96 : 32} />
                <small>{TIER_NAME[open.tier]}</small>
              </div>
            )}
            <h2>{hidden(open) ? "Secret achievement" : open.name}</h2>
            <p>{hidden(open) ? `Hint: ${open.hint}` : open.desc}</p>
            {achievements[open.id] && (
              <div class="adv-unlocked">
                <p class="group-hint">Unlocked {longDate(achievements[open.id])}</p>
                <button class="btn" onClick={() => replayToast(open.id)}>Replay</button>
              </div>
            )}
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
