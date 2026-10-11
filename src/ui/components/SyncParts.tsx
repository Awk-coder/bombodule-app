import type { ComponentChildren } from "preact";
import { semesterLabelDiffers } from "../../domain/actions";
import { ymd } from "../../domain/time";
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
              This slip is for {p.sessionName}, but you're still in {state.semester?.label}. Saving keeps your current attendance. Start a new semester only if the old one is over.
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
  if (sync.progress) {
    return (
      <div class="card sync-progress">
        <p class="group-hint">{sync.progress.message}</p>
        {sync.progress.percent !== undefined && (
          <div class="adv-progress">
            <span style={{ width: `${sync.progress.percent}%` }} />
          </div>
        )}
      </div>
    );
  }
  if (!sync.error) return null;
  return (
    <div class="card">
      <p class="error">{sync.error.message}</p>
    </div>
  );
}

/** A label styled by the caller that opens the system file picker for the slip PDF or image. */
export function SlipPicker({ sync, class: cls, children }: { sync: SyncState; class: string; children: ComponentChildren }) {
  return (
    <label class={cls} aria-disabled={sync.busy}>
      {children}
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,.png,.jpg,.jpeg"
        hidden
        disabled={sync.busy}
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = ""; // let the same file be picked again
          if (file) void sync.start(file);
        }}
      />
    </label>
  );
}
