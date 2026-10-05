import { useState } from "preact/hooks";
import { isPaused, parseImport, serialize, setPaused, setSemesterEnd, updateSettings } from "../../domain/actions";
import { ymd } from "../../domain/time";
import { DEFAULT_LIMIT } from "../../domain/types";
import type { AppState } from "../../domain/types";
import { shareFile } from "../../native/share";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate, initials, shortName } from "../format";
import { useSync } from "../useSync";
import { IconChevron } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { Sheet } from "../components/Sheet";
import { SlipPicker, SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";
import { Toggle } from "../components/Toggle";

export function Settings() {
  const state = useAppState();
  const sync = useSync();
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const today = ymd(new Date());
  const acc = state.account;

  async function onImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      setImportError(null);
      setPendingImport(parseImport(await file.text()));
    } catch (err) {
      setImportError((err as Error).message);
    }
  }

  function confirmImport() {
    const imported = pendingImport;
    if (imported) dispatch(() => imported);
    setPendingImport(null);
  }

  return (
    <>
      <h1 class="page-title">Settings</h1>

      <div class="profile">
        <div class="avatar">{initials(acc?.name)}</div>
        <div>
          <b>{acc?.name ? shortName(acc.name) : "No timetable yet"}</b>
          <small>{acc ? `${acc.matric ?? "Matric unknown"} · imported ${fmtDate(acc.lastSync)}` : "Import your confirmation slip to load your timetable"}</small>
        </div>
      </div>

      <p class="group-title">Timetable</p>
      <p class="group-hint">In i-Ma'luum, open the Course Registration Confirmation Slip and print it to PDF. Import it again whenever your classes change.</p>
      <SlipPicker sync={sync} class="row">
        <div class="grow"><b>{acc ? "Import new slip" : "Import confirmation slip"}</b><small>{sync.busy ? "Reading…" : "PDF from i-Ma'luum"}</small></div>
        <IconChevron />
      </SlipPicker>
      <SyncErrorCard sync={sync} />

      {state.semester && (
        <>
          <p class="group-title">Semester</p>
          <label class="field">
            <span>{state.semester.label} ends on</span>
            <input
              type="date"
              min={state.semester.start}
              value={state.semester.end}
              onChange={(e) => {
                const v = e.currentTarget.value;
                if (v) dispatch((s) => setSemesterEnd(s, v));
              }}
            />
          </label>
        </>
      )}

      <p class="group-title">Prompts</p>
      <div class="row">
        <div class="grow"><b>Pause prompts</b><small>For mid-sem break and holidays</small></div>
        <Toggle on={isPaused(state)} onChange={(v) => dispatch((s) => setPaused(s, v, today))} />
      </div>
      <label class="field">
        <span>Ask "Did you attend?"</span>
        <select value={String(state.settings.promptDelayMin)} onChange={(e) => dispatch((s) => updateSettings(s, { promptDelayMin: Number(e.currentTarget.value) }))}>
          {[0, 5, 10, 15].map((m) => <option key={m} value={String(m)}>{m === 0 ? "When class ends" : `${m} min after class`}</option>)}
        </select>
      </label>
      <label class="field">
        <span>Task reminder time (day before due)</span>
        <input
          type="time"
          value={state.settings.taskReminderTime}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (v) dispatch((s) => updateSettings(s, { taskReminderTime: v }));
          }}
        />
      </label>
      <div class="row">
        <div class="grow"><b>Absence warnings</b><small>Alert at {DEFAULT_LIMIT - 1} of {DEFAULT_LIMIT} missed</small></div>
        <Toggle on={state.settings.warningsEnabled} onChange={(v) => dispatch((s) => updateSettings(s, { warningsEnabled: v }))} />
      </div>

      <p class="group-title">Permissions</p>
      <PermissionRows />

      <p class="group-title">Backup</p>
      <button class="row" onClick={() => void shareFile(`hadir-backup-${today}.json`, serialize(state))}>
        <div class="grow"><b>Export data</b><small>Save a backup file (Drive, Telegram, …)</small></div>
        <IconChevron />
      </button>
      <label class="row">
        <div class="grow"><b>Import data</b><small>Replace everything with a backup file</small></div>
        <IconChevron />
        <input type="file" accept="application/json,.json" hidden onChange={(e) => void onImportFile(e)} />
      </label>
      {importError && <p class="error">{importError}</p>}

      <Sheet open={!!pendingImport} onClose={() => setPendingImport(null)}>
        <h2>Replace all data?</h2>
        <p class="group-hint">
          Everything on this phone will be replaced with the backup ({pendingImport?.courses.length ?? 0} courses, {pendingImport?.tasks.length ?? 0} tasks).
        </p>
        <button class="btn primary" onClick={confirmImport}>Replace</button>
        <button class="btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
      </Sheet>
      <SyncPreviewSheet sync={sync} />
    </>
  );
}
