import { seasonElo } from "../domain/elo";
import { degree, tierOf } from "../domain/grades";
import { titleText } from "../domain/titles";
import type { AppState } from "../domain/types";

/** What the server shows about this player: title, season Elo, degree badge and tier (never the CGPA), achievement count. */
export function profileStats(state: AppState, now: Date) {
  if (!state.semester) return null;
  const season = seasonElo(state, now);
  const d = degree(state.results, state.settings.exemptedCredits);
  const tier = d?.ok ? tierOf(d.cgpa) : null;
  return {
    title: state.title ? titleText(state, state.title) : null,
    stats: {
      season: state.semester.label,
      rated: season.rated,
      elo: season.elo,
      degreeOre: tier?.ore ?? null,
      degreeTier: tier?.tier ?? null,
      achievements: Object.keys(state.achievements).length,
    },
  };
}
