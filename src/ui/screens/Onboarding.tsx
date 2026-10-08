import { useState } from "preact/hooks";
import { completeOnboarding, setSemesterEnd } from "../../domain/actions";
import type { Profile } from "../../domain/types";
import { apiUrl, call } from "../../online/api";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate } from "../format";
import { useSync } from "../useSync";
import { IconClock } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { PUBLIC_NOTE } from "../components/ProfileSection";
import { SlipPicker, SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";

/** Optional leaderboard profile; the name starts blank because it goes public. */
function LeaderboardStep({ onDone }: { onDone: () => void }) {
  const state = useAppState();
  const profile = state.profile;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let p = profile;
      if (!p) {
        p = await call<Profile>("/players", { method: "POST", body: { name } });
        dispatch((s) => ({ ...s, profile: p }));
      }
      if (code.trim()) {
        const joined = await call<{ code: string }>("/groups/join", { method: "POST", key: p.key, body: { code } });
        dispatch((s) => ({ ...s, profile: { ...p!, group: joined.code } }));
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="onboard">
      <h1>Join the leaderboard</h1>
      <p>Race your friends and the rest of IIUM on season Elo. Optional, and you can do it later in Settings.</p>
      <p class="group-hint">{PUBLIC_NOTE}</p>
      <label class="field">
        <span>Name</span>
        <input maxLength={16} placeholder="A nickname works" value={name} disabled={!!profile} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <label class="field">
        <span>Friend's group code (optional)</span>
        <input maxLength={6} autoCapitalize="characters" value={code} onInput={(e) => setCode(e.currentTarget.value)} />
      </label>
      {error && <p class="error">{error}</p>}
      <button class="btn primary" disabled={busy || (!profile && !name.trim()) || (!!profile && !code.trim())} onClick={() => void submit()}>
        {profile ? "Join group" : "Create profile"}
      </button>
      <button class="btn ghost" onClick={onDone}>{profile ? "Continue" : "Skip"}</button>
    </div>
  );
}

export function Onboarding() {
  const state = useAppState();
  const sync = useSync();
  const [step, setStep] = useState(0);
  const [askLeaderboard] = useState(() => !!apiUrl() && !state.profile);
  const linked = state.courses.some((c) => c.active);

  if (step === 0) {
    return (
      <div class="onboard">
        <div class="logo"><IconClock size={30} /></div>
        <h1>Uni Ranked</h1>
        <p>Track attendance and tasks for your IIUM classes, so you never get barred.</p>
        <p>In i-Ma'luum, open your Course Registration Confirmation Slip and print it to PDF. Import that file and Uni Ranked builds your timetable.</p>
        {linked ? (
          <>
            <div class="card">Timetable saved: {state.courses.filter((c) => c.active).length} courses</div>
            <button class="btn primary" onClick={() => setStep(1)}>Continue</button>
          </>
        ) : (
          <>
            <SlipPicker sync={sync} class="btn primary">{sync.busy ? "Reading…" : "Import confirmation slip"}</SlipPicker>
            <button class="btn ghost" onClick={() => setStep(1)}>Skip for now</button>
          </>
        )}
        <SyncErrorCard sync={sync} />
        <SyncPreviewSheet sync={sync} />
      </div>
    );
  }

  if (step === 1 && state.semester) {
    const sem = state.semester;
    return (
      <div class="onboard">
        <h1>Semester</h1>
        <p>Classes count from {fmtDate(sem.start)}. When does {sem.label} end? You can change this later in Settings.</p>
        <label class="field">
          <input
            type="date"
            min={sem.start}
            value={sem.end}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v) dispatch((s) => setSemesterEnd(s, v));
            }}
          />
        </label>
        <button class="btn primary" onClick={() => setStep(2)}>Continue</button>
      </div>
    );
  }

  if (step <= 2 && askLeaderboard) return <LeaderboardStep onDone={() => setStep(3)} />;

  return (
    <div class="onboard">
      <h1>Notifications</h1>
      <p>Uni Ranked asks "Did you attend?" when each class starts. Turn these on so the prompts arrive on time.</p>
      <PermissionRows />
      <button class="btn primary" onClick={() => dispatch(completeOnboarding)}>Finish</button>
    </div>
  );
}
