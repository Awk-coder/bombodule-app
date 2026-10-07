import { ACHIEVEMENTS } from "../../domain/achievements";
import { useAppState } from "../../store/store";

export function AchievementGrid() {
  const { achievements } = useAppState();
  const got = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  return (
    <>
      <h2 class="section-title">Achievements <span class="count">{got} / {ACHIEVEMENTS.length}</span></h2>
      <div class="adv-grid">
        {ACHIEVEMENTS.map((a) => {
          const on = !!achievements[a.id];
          const hidden = a.secret && !on;
          return (
            <div key={a.id} class={`adv ${on ? "on" : ""} ${a.secret ? "secret" : ""}`}>
              <b>{hidden ? "???" : a.name}</b>
              <small>{hidden ? "Secret" : a.desc}</small>
            </div>
          );
        })}
      </div>
    </>
  );
}
