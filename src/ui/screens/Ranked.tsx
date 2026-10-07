import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { clearGraduated, removeResult, setGraduated } from "../../domain/actions";
import { DELTA, seasonElo } from "../../domain/elo";
import { DIVISIONS, degree, gpa, rankOf, semesterMismatch, sortResults, tierOf } from "../../domain/grades";
import type { Ore } from "../../domain/grades";
import type { SemesterResult } from "../../domain/types";
import type { ParsedResult } from "../../iium/results";
import { dispatch, useAppState } from "../../store/store";
import { titleCase } from "../format";
import { useNow } from "../useNow";
import { useResultImport } from "../useResultImport";
import { AchievementGrid } from "../components/AchievementGrid";
import { ORE_COLOR, ORE_NAME, RankBadge, divLabel, leakOf } from "../components/RankBadge";
import { Sheet } from "../components/Sheet";

function ResultPicker({ imp }: { imp: ReturnType<typeof useResultImport> }) {
  return (
    <label class="btn primary" aria-disabled={imp.busy}>
      {imp.busy ? "Reading…" : "Import result slip"}
      <input
        type="file"
        accept="application/pdf"
        hidden
        disabled={imp.busy}
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = "";
          if (file) void imp.start(file);
        }}
      />
    </label>
  );
}

function ResultSheet({ r, onClose, onRemove, children }: { r: ParsedResult; onClose: () => void; onRemove?: () => void; children?: ComponentChildren }) {
  const g = gpa(r.courses).gpa;
  const mismatch = semesterMismatch({ ...r, remarks: "", importedAt: "" });
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet open onClose={onClose}>
      <div class="result-head">
        <RankBadge kind={tierOf(g).ore} size={48} />
        <div>
          <h2>{r.label}</h2>
          <p class="group-hint">GPA {g.toFixed(2)} · {tierOf(g).tier} tier{r.status ? ` · ${r.status}` : ""}</p>
        </div>
      </div>
      {r.courses.map((c) => (
        <div class="row" key={c.code}>
          <div class="grow"><b>{c.code}</b><small>{titleCase(c.title)}</small></div>
          <b>{c.grade}</b>
        </div>
      ))}
      {mismatch && <p class="error">{mismatch}</p>}
      {children}
      {onRemove && !confirm && <button class="btn ghost danger" onClick={() => setConfirm(true)}>Remove result</button>}
      {onRemove && confirm && (
        <>
          <p class="group-hint">Remove {r.label}? You can import the slip again later.</p>
          <button class="btn primary danger" onClick={onRemove}>Yes, remove</button>
          <button class="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}

const PROMO_KEY = "hadir-last-ore";
const ORDER = ["coal", "iron", "gold", "emerald", "diamond", "netherite"];

/** "up" or "down" once when the ore changed since the screen was last shown. */
function useRankChange(ore: string | null): "up" | "down" | null {
  const [change] = useState((): "up" | "down" | null => {
    if (!ore) return null;
    let last: string | null = null;
    try {
      last = localStorage.getItem(PROMO_KEY);
      localStorage.setItem(PROMO_KEY, ore);
    } catch {}
    if (last === null || last === ore || !ORDER.includes(last)) return null;
    return ORDER.indexOf(ore) > ORDER.indexOf(last) ? "up" : "down";
  });
  return change;
}

const ORES = ORDER as Ore[];
const range = (ore: Ore) => {
  const divs = DIVISIONS.filter((d) => d.ore === ore);
  const next = DIVISIONS[DIVISIONS.indexOf(divs.at(-1)!) + 1];
  return next ? `${divs[0].min}–${next.min - 1}` : `${divs[0].min}+`;
};

function HowRanking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fmt = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>How ranking works</h2>
      <p class="group-hint">Your season Elo starts from last semester's GPA and moves with your tasks. It starts over each semester, from your newest result slip.</p>
      <div class="how-rules">
        <div><b class="up">{fmt(DELTA.onTime)}</b><span>Task done on time</span></div>
        <div><b class="up">{fmt(DELTA.finalOnTime)}</b><span>Final assignment done on time</span></div>
        <div><b class="down">{fmt(DELTA.late)}</b><span>Task done late</span></div>
        <div><b class="down">{fmt(DELTA.missed)}</b><span>Task missed</span></div>
        <div><b class="down">{fmt(DELTA.finalMissed)}</b><span>Final assignment missed</span></div>
      </div>
      <h3 class="how-title">Ranks</h3>
      {[...ORES].reverse().map((ore) => (
        <div class="how-rank" key={ore}>
          <RankBadge kind={ore} size={40} />
          <b style={{ color: ORE_COLOR[ore] }}>{ORE_NAME[ore]}</b>
          <span>{range(ore)}</span>
        </div>
      ))}
      <p class="group-hint">Each rank below Netherite has divisions I, II and III. Your degree rank is separate: it comes from your CGPA once every result slip is imported.</p>
    </Sheet>
  );
}

export function SeasonCard({ season, rank }: { season: ReturnType<typeof seasonElo>; rank: ReturnType<typeof rankOf> }) {
  const state = useAppState();
  const kind = season.rated ? rank.ore : "unrated";
  const change = useRankChange(season.rated ? rank.ore : null);
  const [how, setHow] = useState(false);
  const [all, setAll] = useState(false);
  return (
    <section class={`season ${change === "up" ? "promoted" : ""}`}>
      <RankBadge kind={kind} size={180} />
      <b class="season-elo">{season.elo}</b>
      <h2 class="season-rank" style={{ color: ORE_COLOR[rank.ore] }}>{ORE_NAME[rank.ore]} {divLabel(rank.div)}</h2>
      {change && <p class={`rank-change ${change}`}>{change === "up" ? "Promoted to" : "Dropped to"} {ORE_NAME[rank.ore]}</p>}
      <p class="season-sub">{state.semester?.label ?? "This semester"}</p>
      {!season.rated && <p class="season-sub">Import last semester's slip to get placed</p>}
      <small class="elo-next">{rank.next === null ? "Top rank" : `${rank.next - season.elo} to next division`}</small>
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
  const d = degree(results);
  const dKind = d?.ok ? tierOf(d.cgpa).ore : "unrated";
  const now = useNow();
  const season = seasonElo(state, now);
  const rank = rankOf(season.elo);
  const leak = season.rated ? leakOf(rank.ore, rank.progress) : 0;

  return (
    <div class="ranked" style={leak ? { "--leak-color": ORE_COLOR[rank.ore], "--leak": `${Math.round(leak * 100)}%` } : undefined}>
      {leak > 0 && <div class="rank-leak" aria-hidden />}
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
      {results.length > 0 && <p class="group-hint backup-hint">Results are saved on this phone only. <a href="#/settings">Back them up in Settings</a>.</p>}
      {results.length > 0 && !state.graduated && (
        <button class="btn ghost" onClick={() => setConfirmGrad(true)}>I've graduated</button>
      )}
      {state.graduated && (
        <button class="btn ghost" onClick={() => dispatch(clearGraduated)}>Undo graduation</button>
      )}
      <Sheet open={confirmGrad} onClose={() => setConfirmGrad(false)}>
        <h2>Mark yourself as graduated?</h2>
        <p class="group-hint">You can undo this later from this screen.</p>
        <button class="btn primary" onClick={() => { dispatch((s) => setGraduated(s, new Date())); setConfirmGrad(false); }}>Yes, I've graduated</button>
        <button class="btn ghost" onClick={() => setConfirmGrad(false)}>Cancel</button>
      </Sheet>
      {imp.error && <p class="error">{imp.error.message}</p>}
      <AchievementGrid />
      {imp.preview && (
        <ResultSheet r={imp.preview} onClose={imp.cancel}>
          <button class="btn primary" onClick={imp.confirm}>Save result</button>
          <button class="btn ghost" onClick={imp.cancel}>Cancel</button>
        </ResultSheet>
      )}
      {open && <ResultSheet r={open} onClose={() => setOpen(null)} onRemove={() => { dispatch((s) => removeResult(s, open.label)); setOpen(null); }} />}
    </div>
  );
}
