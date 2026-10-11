import { go } from "../router";

export function LinkCard() {
  return (
    <div class="card muted">
      <p>Import your confirmation slip to load your timetable.</p>
      <button class="btn primary" onClick={() => go("#/settings")}>Go to Settings</button>
    </div>
  );
}
