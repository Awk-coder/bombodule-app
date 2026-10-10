import { useState } from "preact/hooks";
import { clearGraduated, graduationConfirmed, removeResult, setGraduated } from "../../domain/actions";
import { DELTA, seasonElo } from "../../domain/elo";
import { DIVISIONS, degree, gpa, rankOf, sortResults, tierOf } from "../../domain/grades";
import type { Ore } from "../../domain/grades";
import { titleText } from "../../domain/titles";
import type { SemesterResult } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { useNow } from "../useNow";
import { useResultImport } from "../useResultImport";
import { AchievementGrid } from "../components/AchievementGrid";
import { Leaderboard } from "../components/Leaderboard";
import { ResultPicker, ResultSheet } from "../components/ResultSlip";
import { ORE_COLOR, ORE_NAME, RankBadge, divLabel } from "../components/RankBadge";
import { Sheet } from "../components/Sheet";
import { ShaderGradientBackground } from "../components/ShaderGradientBackground";

const ORES: Ore[] = ["coal", "iron", "gold", "emerald", "diamond", "netherite"];
const range = (ore: Ore) => {
  const divs = DIVISIONS.filter((d) => d.ore === ore);
  const next = DIVISIONS[DIVISIONS.indexOf(divs.at(-1)!) + 1];
  return next ? `${divs[0].min}–${next.min - 1}` : `${divs[0].min}+`;
};

function HowRanking({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>How ranking works</h2>
      <p class="group-hint">Your season Elo starts from last semester's GPA and moves with your tasks. It starts over each semester, from your newest result slip.</p>

      <div class="how-card">
        <h3 class="how-sub">Task Scoring</h3>
        <div class="how-rules">
          <div><b class="up">+{DELTA.onTime}</b><span>Task done on time (+3 in Emerald, +2 in Diamond, +1 in Netherite)</span></div>
          <div><b class="up">+{DELTA.finalOnTime}</b><span>Final assignment done on time (+15 in Emerald, +10 in Diamond, +5 in Netherite)</span></div>
          <div><b class="down">{DELTA.late}</b><span>Task done late</span></div>
          <div><b class="down">{DELTA.missed}</b><span>Task missed</span></div>
          <div><b class="down">{DELTA.finalMissed}</b><span>Final assignment missed</span></div>
        </div>
      </div>

      <div class="how-card">
        <h3 class="how-sub">Season Mechanics</h3>
        <div class="how-mechanics">
          <div class="how-mech-row">
            <span class="how-mech-badge">⚡</span>
            <div><b>Weekly Cap:</b> Max 5 on-time tasks per calendar week give positive Elo.</div>
          </div>
          <div class="how-mech-row">
            <span class="how-mech-badge">🛡️</span>
            <div><b>Academic Integrity:</b> Tasks must belong to an enrolled course. Completed tasks require a 30-minute minimum incubation to award Elo. Non-academic tasks award 0 Elo.</div>
          </div>
          <div class="how-mech-row">
            <span class="how-mech-badge">📚</span>
            <div><b>Overload Bonus:</b> Semesters with &gt;18 credits gain +10 Elo for every credit above 18.</div>
          </div>
          <div class="how-mech-row">
            <span class="how-mech-badge">🔥</span>
            <div><b>One-Time Comeback:</b> Students with &le;2.20 GPA in a past semester gain a one-time +100 Elo bonus and 1.35× task velocity buff when jumping &ge;+1.0 GPA (+50 Elo for &ge;+0.5). Once you climb you must stay there.</div>
          </div>
          <div class="how-mech-row">
            <span class="how-mech-badge">⏳</span>
            <div><b>Short Semesters:</b> Sem 3 is capped at Diamond III (max 1999 Elo) without bonuses.</div>
          </div>
        </div>
      </div>

      <div class="how-card">
        <h3 class="how-sub">Ranks</h3>
        <div class="how-ladder">
          {[...ORES].reverse().map((ore) => (
            <div class="how-rank" key={ore}>
              <RankBadge kind={ore} size={36} />
              <b style={{ color: ORE_COLOR[ore] }}>{ORE_NAME[ore]}</b>
              <span>{range(ore)}</span>
            </div>
          ))}
        </div>
        <p class="how-foot">Each rank below Netherite has divisions I, II and III. Your degree rank is separate: it comes from your CGPA once every result slip is imported.</p>
      </div>
    </Sheet>
  );
}

export function SeasonCard({ season, rank }: { season: ReturnType<typeof seasonElo>; rank: ReturnType<typeof rankOf> }) {
  const state = useAppState();
  const kind = season.rated ? rank.ore : "unrated";
  const [how, setHow] = useState(false);
  const [all, setAll] = useState(false);
  const title = state.title ? titleText(state, state.title) : null;
  const pb = season.placementBreakdown;
  return (
    <section class="season">
      <RankBadge kind={kind} div={season.rated ? rank.div : null} size={180} />
      <b class="season-elo">{season.elo}</b>
      <h2 class="season-rank" style={{ color: ORE_COLOR[rank.ore] }}>{ORE_NAME[rank.ore]} {divLabel(rank.div)}</h2>
      {title && <p class="season-title">{title}</p>}
      {season.comebackActive && (
        <span class="buff-pill">🔥 1.35× Comeback Velocity Active</span>
      )}
      <p class="season-sub">{state.semester?.label ?? "This semester"}</p>
      {!season.rated && <p class="season-sub">Import last semester's slip to get placed</p>}
      {season.rated && pb && (pb.loadBonus > 0 || pb.comebackBonus > 0) && (
        <small class="placement-breakdown">
          Placed {season.placement} Elo (Base {pb.base}
          {pb.loadBonus > 0 ? ` + ${pb.loadBonus} Overload` : ""}
          {pb.comebackBonus > 0 ? ` + ${pb.comebackBonus} Comeback` : ""})
        </small>
      )}
      <small class="elo-next">{rank.next === null ? "Top rank" : `${rank.next - season.elo} to next division`}</small>
      {season.rated && (
        <div class={`weekly-cap-indicator ${season.weeklyTaskCount >= 5 ? "capped" : ""}`}>
          <span>{season.weeklyTaskCount >= 5 ? "⚡ Weekly task cap reached (5/5)" : `⚡ Weekly Ranked Tasks: ${season.weeklyTaskCount}/5`}</span>
        </div>
      )}
      {season.changes.length > 0 && (
        <div class="card elo-changes">
          {season.changes.slice(0, all ? undefined : 4).map((c) => (
            <div class="elo-change" key={c.taskId}>
              <span class={c.delta > 0 ? "up" : "down"}>{c.delta > 0 ? `+${c.delta}` : c.delta}</span>
              <span>{c.title}</span>
            </div>
          ))}
          {!all && season.changes.length > 4 && <button class="link show-all" onClick={() => setAll(true)}>Show all {season.changes.length}</button>}
        </div>
      )}
      <button class="link how-link" onClick={() => setHow(true)}>How ranking works</button>
      <HowRanking open={how} onClose={() => setHow(false)} />
    </section>
  );
}

export function Ranked() {
  const state = useAppState();
  const imp = useResultImport();
  const [open, setOpen] = useState<SemesterResult | null>(null);
  const [confirmGrad, setConfirmGrad] = useState(false);
  const results = sortResults(state.results);
  const d = degree(results, state.settings.exemptedCredits);
  const dKind = d?.ok ? tierOf(d.cgpa).ore : "unrated";
  const now = useNow();
  const season = seasonElo(state, now);
  const rank = rankOf(season.elo);
  const lastPaperDone = !state.semester || state.examsDone.includes(state.semester.label);

  return (
    <div class="ranked">
      <ShaderGradientBackground ore={season.rated ? rank.ore : "coal"} />
      <h1 class="page-title">Ranked</h1>
      <SeasonCard season={season} rank={rank} />

      <section class="card degree">
        <RankBadge kind={dKind} size={76} />
        <div>
          <small>Degree rank</small>
          <b style={{ color: ORE_COLOR[dKind] }}>{ORE_NAME[dKind]}{d?.ok ? ` · ${tierOf(d.cgpa).tier}` : ""}</b>
          {d?.ok && <span>CGPA {d.cgpa.toFixed(2)}</span>}
          {!d && <small>Import every semester's result slip to get ranked.</small>}
          {d && !d.ok && <small>{d.reason}</small>}
        </div>
      </section>

      {results.length > 0 && (
        <>
          <h2 class="section-title">History</h2>
          <div class="history">
            {results.map((r) => {
              const g = gpa(r.courses).gpa;
              return (
                <button key={r.label} class="history-item" onClick={() => setOpen(r)}>
                  <RankBadge kind={tierOf(g).ore} size={64} />
                  <b>{g.toFixed(2)}</b>
                  <small>{r.label.replace("Sem ", "S").replace(/, (\d{2})(\d{2})\/\d{2}(\d{2})/, " $2/$3")}</small>
                </button>
              );
            })}
          </div>
        </>
      )}

      <ResultPicker imp={imp} />
      {imp.progress && (
        <div class="card sync-progress" style="margin-top: 8px;">
          <p class="group-hint">{imp.progress.message}</p>
          {imp.progress.percent !== undefined && (
            <div class="adv-progress">
              <span style={{ width: `${imp.progress.percent}%` }} />
            </div>
          )}
        </div>
      )}
      {results.length > 0 && <p class="group-hint backup-hint">Results are saved on this phone only. <a href="#/settings">Back them up in Settings</a>.</p>}
      {results.length > 0 && !state.graduated && lastPaperDone && (
        <button class="btn ghost" onClick={() => setConfirmGrad(true)}>I've graduated</button>
      )}
      {state.graduated && !graduationConfirmed(state) && (
        <div class="card grad-pending">
          <b>Graduation pending</b>
          <small>It counts once you import your {state.semester?.label} result slip.</small>
        </div>
      )}
      {state.graduated && (
        <button class="btn ghost" onClick={() => dispatch(clearGraduated)}>Undo graduation</button>
      )}
      <Sheet open={confirmGrad} onClose={() => setConfirmGrad(false)}>
        <h2>Mark yourself as graduated?</h2>
        <p class="group-hint">{state.semester && !state.results.some((r) => r.label === state.semester!.label) ? `It counts once you import your ${state.semester.label} result slip. ` : ""}You can undo this later from this screen.</p>
        <button class="btn primary" onClick={() => { dispatch((s) => setGraduated(s, new Date())); setConfirmGrad(false); }}>Yes, I've graduated</button>
        <button class="btn ghost" onClick={() => setConfirmGrad(false)}>Cancel</button>
      </Sheet>
      {imp.error && <p class="error">{imp.error.message}</p>}
      <Leaderboard />
      <AchievementGrid />
      {imp.preview && (
        <ResultSheet r={imp.preview} onClose={imp.cancel} onUpdateCourse={imp.updatePreviewCourse}>
          <button class="btn primary" onClick={imp.confirm}>Save result</button>
          <button class="btn ghost" onClick={imp.cancel}>Cancel</button>
        </ResultSheet>
      )}
      {open && <ResultSheet r={open} onClose={() => setOpen(null)} onRemove={() => { dispatch((s) => removeResult(s, open.label)); setOpen(null); }} />}
    </div>
  );
}
