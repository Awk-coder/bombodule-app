import { useState } from "preact/hooks";
import { isPaused, parseImport, serialize, setPaused, setSemesterEnd, updateSettings } from "../../domain/actions";
import { ymd } from "../../domain/time";
import { DEFAULT_LIMIT } from "../../domain/types";
import type { AppState } from "../../domain/types";
import { shareFile } from "../../native/share";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate, initials, shortName } from "../format";
import { useSync } from "../useSync";
import { useUpdater } from "../useUpdater";
import { Chips } from "../components/Chips";
import { IconChevron } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { ProfileSection } from "../components/ProfileSection";
import { Sheet } from "../components/Sheet";
import { SlipPicker, SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";
import { Toggle } from "../components/Toggle";
import { THEMES, themeById } from "../themes";

export function Settings() {
  const state = useAppState();
  const sync = useSync();
  const updater = useUpdater();
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const theme = themeById(state.settings.theme);
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

      <ProfileSection />

      <p class="group-title">Appearance</p>
      <button class="row" onClick={() => setThemeOpen(true)}>
        <div class="grow"><b>Theme</b><small>{theme.name}</small></div>
        <span class="theme-dot">{theme.swatch.map((c) => <span key={c} style={`background:${c}`} />)}</span>
      </button>

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

      <p class="group-title">Degree rank</p>
      <label class="field">
        <span>Exempted credit hours (max 3)</span>
        <input
          type="number"
          min="0"
          max="3"
          step="0.5"
          value={state.settings.exemptedCredits || ""}
          placeholder="0"
          onInput={(e) => {
            const raw = e.currentTarget.value.trim();
            const val = raw === "" ? 0 : parseFloat(raw) || 0;
            const clamped = Math.min(3, Math.max(0, val));
            dispatch((s) => updateSettings(s, { exemptedCredits: clamped }));
          }}
        />
      </label>
      <p class="group-hint">If any courses were exempted, counts up to 3 credit hours so your degree rank unlocks.</p>

      <p class="group-title">Prompts</p>
      <div class="row">
        <div class="grow"><b>Pause prompts</b><small>For mid-sem break and holidays</small></div>
        <Toggle on={isPaused(state)} onChange={(v) => dispatch((s) => setPaused(s, v, today))} />
      </div>
      <div class="field">
        <span>Ask "Did you attend?"</span>
        <Chips
          options={[0, 5, 10, 15].map((m) => ({ value: m, label: m === 0 ? "At start" : `${m} min` }))}
          value={state.settings.promptDelayMin}
          onChange={(m) => dispatch((s) => updateSettings(s, { promptDelayMin: m }))}
        />
      </div>
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
      <button class="row" onClick={() => void shareFile(`uni-ranked-backup-${today}.json`, serialize(state))}>
        <div class="grow"><b>Export data</b><small>Save a backup file (Drive, Telegram, …)</small></div>
        <IconChevron />
      </button>
      <label class="row">
        <div class="grow"><b>Import data</b><small>Replace everything with a backup file</small></div>
        <IconChevron />
        <input type="file" accept="application/json,.json" hidden onChange={(e) => void onImportFile(e)} />
      </label>
      {importError && <p class="error">{importError}</p>}

      <p class="group-title">Updates</p>
      <div class="row">
        <div class="grow">
          <b>Uni Ranked v{updater.currentVersion}</b>
          <small>
            {updater.checking
              ? "Checking GitHub for updates…"
              : updater.info?.updateAvailable
              ? `New version ${updater.info.latestVersion} available!`
              : "App is up to date"}
          </small>
        </div>
        {updater.info?.updateAvailable ? (
          <button class="btn primary sm" disabled={updater.downloading} onClick={() => void updater.install()}>
            {updater.downloading ? `${updater.progress}%` : "Update"}
          </button>
        ) : (
          <button class="btn ghost sm" disabled={updater.checking} onClick={() => void updater.check()}>
            {updater.checking ? "Checking…" : "Check now"}
          </button>
        )}
      </div>

      <Sheet open={!!pendingImport} onClose={() => setPendingImport(null)}>
        <h2>Replace all data?</h2>
        <p class="group-hint">
          Everything on this phone will be replaced with the backup ({pendingImport?.courses.length ?? 0} courses, {pendingImport?.tasks.length ?? 0} tasks).
        </p>
        <button class="btn primary" onClick={confirmImport}>Replace</button>
        <button class="btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
      </Sheet>
      <Sheet open={themeOpen} onClose={() => setThemeOpen(false)}>
        <h2>Theme</h2>
        <div class="themes" role="radiogroup">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === theme.id}
              class={t.id === theme.id ? "theme-opt on" : "theme-opt"}
              onClick={() => {
                dispatch((s) => updateSettings(s, { theme: t.id }));
                setThemeOpen(false);
              }}
            >
              <div class="swatch">{t.swatch.map((c) => <span key={c} style={`background:${c}`} />)}</div>
              <b>{t.name}</b>
            </button>
          ))}
        </div>
      </Sheet>
      <SyncPreviewSheet sync={sync} />
    </>
  );
}
