import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { setGraduated } from "../../domain/actions";
import { seasonElo } from "../../domain/elo";
import { degree, gpa, rankOf, semesterMismatch, sortResults, tierOf } from "../../domain/grades";
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

function ResultSheet({ r, onClose, children }: { r: ParsedResult; onClose: () => void; children?: ComponentChildren }) {
  const g = gpa(r.courses).gpa;
  const mismatch = semesterMismatch({ ...r, remarks: "", importedAt: "" });
  return (
    <Sheet open onClose={onClose}>
      <h2>{r.label}</h2>
      <p class="group-hint">GPA {g.toFixed(2)} · {tierOf(g).tier} tier{r.status ? ` · ${r.status}` : ""}</p>
      {r.courses.map((c) => (
        <div class="row" key={c.code}>
          <div class="grow"><b>{c.code}</b><small>{titleCase(c.title)}</small></div>
          <b>{c.grade}</b>
        </div>
      ))}
      {mismatch && <p class="error">{mismatch}</p>}
      {children}
    </Sheet>
  );
}

const PROMO_KEY = "hadir-last-ore";
const ORDER = ["coal", "iron", "gold", "emerald", "diamond", "netherite"];

/** True once when the ore went up since the screen was last shown. */
function usePromotion(ore: string): boolean {
  const [promoted] = useState(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(PROMO_KEY);
      localStorage.setItem(PROMO_KEY, ore);
    } catch {}
    return last !== null && ORDER.indexOf(ore) > ORDER.indexOf(last);
  });
  return promoted;
}

export function SeasonCard({ season, rank }: { season: ReturnType<typeof seasonElo>; rank: ReturnType<typeof rankOf> }) {
  const state = useAppState();
  const kind = season.rated ? rank.ore : "unrated";
  const promoted = usePromotion(rank.ore);
  return (
    <section class={`season ${promoted ? "promoted" : ""}`}>
      <RankBadge kind={kind} size={180} />
      <b class="season-elo">{season.elo}</b>
      <h2 class="season-rank" style={{ color: ORE_COLOR[rank.ore] }}>{ORE_NAME[rank.ore]} {divLabel(rank.div)}</h2>
      <p class="season-sub">{state.semester?.label ?? "This semester"}{season.rated ? "" : " · placement pending"}</p>
      <small class="elo-next">{rank.next === null ? "Top rank" : `${rank.next - season.elo} to next division`}</small>
      {season.changes.length > 0 && (
        <div class="card elo-changes">
          {season.changes.slice(0, 4).map((c) => (
            <div class="elo-change" key={c.taskId}>
              <span class={c.delta > 0 ? "up" : "down"}>{c.delta > 0 ? `+${c.delta}` : c.delta}</span>
              <span>{c.title}</span>
            </div>
          ))}
        </div>
      )}
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
      {results.length > 0 && !state.graduated && (
        <button class="btn ghost" onClick={() => setConfirmGrad(true)}>I've graduated</button>
      )}
      <Sheet open={confirmGrad} onClose={() => setConfirmGrad(false)}>
        <h2>Mark yourself as graduated?</h2>
        <p class="group-hint">This can't be undone.</p>
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
      {open && <ResultSheet r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
