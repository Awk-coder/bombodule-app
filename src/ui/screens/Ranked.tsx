import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { seasonElo } from "../../domain/elo";
import { degree, gpa, rankOf, semesterMismatch, sortResults, tierOf } from "../../domain/grades";
import type { SemesterResult } from "../../domain/types";
import type { ParsedResult } from "../../iium/results";
import { useAppState } from "../../store/store";
import { titleCase } from "../format";
import { useNow } from "../useNow";
import { useResultImport } from "../useResultImport";
import { AchievementGrid } from "../components/AchievementGrid";
import { ORE_COLOR, ORE_NAME, RankBadge, divLabel } from "../components/RankBadge";
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

export function SeasonCard() {
  const state = useAppState();
  const now = useNow();
  const season = seasonElo(state, now);
  const rank = rankOf(season.elo);
  const kind = season.rated ? rank.ore : "unrated";
  const promoted = usePromotion(rank.ore);
  return (
    <section class={`card season ${promoted ? "promoted" : ""}`}>
      <div class="season-head">
        <RankBadge kind={kind} size={112} />
        <div>
          <small>{state.semester?.label ?? "This semester"}{season.rated ? "" : " · placement pending"}</small>
          <b class="pixel" style={`color:${ORE_COLOR[rank.ore]}`}>{ORE_NAME[rank.ore]} {divLabel(rank.div)}</b>
          <span class="pixel elo">{season.elo} Elo</span>
        </div>
      </div>
      <div class="elo-bar"><span style={`width:${Math.round(rank.progress * 100)}%`} /></div>
      <small class="elo-next">{rank.next === null ? "Top rank" : `${rank.next - season.elo} to next division`}</small>
      {season.changes.slice(0, 4).map((c) => (
        <div class="elo-change" key={c.taskId}>
          <span class={`pixel ${c.delta > 0 ? "up" : "down"}`}>{c.delta > 0 ? `+${c.delta}` : c.delta}</span>
          <span>{c.title}</span>
        </div>
      ))}
    </section>
  );
}

export function Ranked() {
  const state = useAppState();
  const imp = useResultImport();
  const [open, setOpen] = useState<SemesterResult | null>(null);
  const results = sortResults(state.results);
  const d = degree(results);
  const dKind = d?.ok ? tierOf(d.cgpa).ore : "unrated";

  return (
    <div class="ranked">
      <h1 class="page-title pixel">Ranked</h1>
      <SeasonCard />

      <section class="card degree">
        <RankBadge kind={dKind} size={112} />
        <div>
          <small>Degree rank</small>
          <b class="pixel" style={`color:${ORE_COLOR[dKind]}`}>{ORE_NAME[dKind]}{d?.ok ? ` · ${tierOf(d.cgpa).tier}` : ""}</b>
          {d?.ok && <span class="pixel">CGPA {d.cgpa.toFixed(2)}</span>}
          {!d && <small>Import every semester's result slip to get ranked.</small>}
          {d && !d.ok && <small>{d.reason}</small>}
        </div>
      </section>

      {results.length > 0 && (
        <>
          <h2 class="section-title pixel">History</h2>
          <div class="history">
            {results.map((r) => {
              const g = gpa(r.courses).gpa;
              return (
                <button key={r.label} class="history-item" onClick={() => setOpen(r)}>
                  <RankBadge kind={tierOf(g).ore} size={48} />
                  <small>{r.label.replace("Sem ", "S").replace(/, (\d{2})(\d{2})\/\d{2}(\d{2})/, " $2/$3")}</small>
                  <b class="pixel">{g.toFixed(2)}</b>
                </button>
              );
            })}
          </div>
        </>
      )}

      <ResultPicker imp={imp} />
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
