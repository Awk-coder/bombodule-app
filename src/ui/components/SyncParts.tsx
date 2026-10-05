import { SyncError } from "../../iium/sync";
import { shareFile } from "../../native/share";
import { titleCase } from "../format";
import type { SyncState } from "../useSync";
import { Sheet } from "./Sheet";

export function SyncPreviewSheet({ sync }: { sync: SyncState }) {
  const p = sync.preview;
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
          <button class="btn primary" onClick={sync.confirm}>Save timetable</button>
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
