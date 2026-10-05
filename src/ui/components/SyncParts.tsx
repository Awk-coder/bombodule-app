import { semesterLabelDiffers } from "../../domain/actions";
import { ymd } from "../../domain/time";
import { SyncError } from "../../iium/sync";
import { shareFile } from "../../native/share";
import { useAppState } from "../../store/store";
import { titleCase } from "../format";
import type { SyncState } from "../useSync";
import { Sheet } from "./Sheet";

export function SyncPreviewSheet({ sync }: { sync: SyncState }) {
  const p = sync.preview;
  const state = useAppState();
  const differs = !!p && semesterLabelDiffers(state, p, ymd(new Date()));
  return (
    <Sheet open={!!p} onClose={sync.cancel}>
      {p && (
        <>
          <h2>Found {p.courses.length} courses</h2>
          <p class="group-hint">{p.sessionName}{p.studentName ? ` · ${titleCase(p.studentName)}` : ""}</p>
          {p.courses.map((c) => (
            <div class="row" key={`${c.code}-${c.section}`}>
              <div class="grow"><b>{c.code}</b><small>{titleCase(c.name)}</small></div>
              <small>{p.slots.filter((s) => s.code === c.code && s.section === c.section).length}× / week</small>
            </div>
          ))}
          {differs && (
            <p class="error">
              i-Ma'luum shows {p.sessionName}, but you're still in {state.semester?.label}. Saving keeps your current attendance. Start a new semester only if the old one is over.
            </p>
          )}
          <button class="btn primary" onClick={() => sync.confirm()}>Save timetable</button>
          {differs && <button class="btn" onClick={() => sync.confirm(true)}>Start new semester</button>}
          <button class="btn ghost" onClick={sync.cancel}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}

export function SyncErrorCard({ sync }: { sync: SyncState }) {
  const err = sync.error;
  if (!err) return null;
  const html = err instanceof SyncError ? err.html : undefined;
  return (
    <div class="card">
      <p class="error">{err.message}</p>
      {html && <button class="btn" onClick={() => void shareFile("imaluum-schedule.html", html, "text/html")}>Share page for debugging</button>}
    </div>
  );
}
