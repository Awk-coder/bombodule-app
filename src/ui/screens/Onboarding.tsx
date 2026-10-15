import { useState } from "preact/hooks";
import { completeOnboarding, setSemesterEnd } from "../../domain/actions";
import type { Profile } from "../../domain/types";
import { apiUrl, call } from "../../online/api";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate } from "../format";
import { useSync } from "../useSync";
import { IconBack, IconLogo } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { PixelIcon, BOOK_ART, LIGHTNING_ART, SHIELD_ART } from "../components/pixelIcons";
import { PUBLIC_NOTE } from "../components/ProfileSection";
import { SlipPicker, SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";

function OnboardHeader({
  current,
  total,
  onBack,
}: {
  current: number;
  total: number;
  onBack?: () => void;
}) {
  return (
    <div class="onboard-progress-bar">
      {onBack ? (
        <button class="onboard-back-btn" onClick={onBack} aria-label="Go back">
          <IconBack size={16} /> Back
        </button>
      ) : (
        <span />
      )}
      <div class="onboard-progress-pills">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} class={`onboard-pill ${i === current ? "active" : i < current ? "done" : ""}`} />
        ))}
      </div>
      <span class="onboard-step-text">Step {current + 1} of {total}</span>
    </div>
  );
}

/** Optional leaderboard profile; the name starts blank because it goes public. */
function LeaderboardStep({
  onDone,
  onBack,
  stepIndex,
  totalSteps,
}: {
  onDone: () => void;
  onBack?: () => void;
  stepIndex: number;
  totalSteps: number;
}) {
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
      <OnboardHeader current={stepIndex} total={totalSteps} onBack={onBack} />
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

  const hasSemester = !!state.semester;
  const totalSteps = 1 + (hasSemester ? 1 : 0) + (askLeaderboard ? 1 : 0) + 1;

  const getStepIndex = (s: number) => {
    if (s === 0) return 0;
    if (s === 1 && hasSemester) return 1;
    if (s <= 2 && askLeaderboard) return hasSemester ? 2 : 1;
    return totalSteps - 1;
  };

  if (step === 0) {
    return (
      <div class="onboard">
        <OnboardHeader current={0} total={totalSteps} />
        <div class="logo"><IconLogo size={36} /></div>
        <h1>Uni Ranked</h1>
        <p>Track attendance and tasks for your IIUM classes, so you never get barred.</p>

        {!linked && (
          <div class="card onboard-pillars">
            <div class="onboard-pillar">
              <PixelIcon art={SHIELD_ART} scale={2} />
              <div>
                <b>Barring Defense</b>
                <small>Automatic absence counters keep you above the 80% attendance rule.</small>
              </div>
            </div>
            <div class="onboard-pillar">
              <PixelIcon art={BOOK_ART} scale={2} />
              <div>
                <b>Instant Timetable</b>
                <small>Import your registration confirmation slip PDF to build your schedule.</small>
              </div>
            </div>
            <div class="onboard-pillar">
              <PixelIcon art={LIGHTNING_ART} scale={2} />
              <div>
                <b>Ranked Elo & Titles</b>
                <small>Complete academic tasks to gain Elo and climb to Netherite rank.</small>
              </div>
            </div>
          </div>
        )}

        {linked ? (
          <>
            <div class="card onboard-success-card">
              <div class="onboard-success-head">
                <span class="chip ok">Ready</span>
                <b>Timetable saved: {state.courses.filter((c) => c.active).length} courses</b>
              </div>
              <small>{state.semester?.label ?? "Current semester"} timetable built with all class timings & venues.</small>
            </div>
            <button class="btn primary" onClick={() => setStep(hasSemester ? 1 : askLeaderboard ? 2 : 3)}>Continue</button>
          </>
        ) : (
          <>
            <p>In i-Ma'luum, open your Course Registration Confirmation Slip and print it to PDF. Import that file and Uni Ranked builds your timetable.</p>
            <SlipPicker sync={sync} class="btn primary">{sync.busy ? "Reading…" : "Import confirmation slip"}</SlipPicker>
            <button class="btn ghost" onClick={() => setStep(hasSemester ? 1 : askLeaderboard ? 2 : 3)}>Skip for now</button>
            <details class="onboard-help-details">
              <summary>How to get your confirmation slip</summary>
              <ol>
                <li>Log in to <b>i-Ma'luum</b> (imaluum.iium.edu.my)</li>
                <li>Go to <b>Course Registration &gt; Confirmation Slip</b></li>
                <li>Tap <b>Print</b> and save as <b>PDF</b></li>
              </ol>
            </details>
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
        <OnboardHeader current={getStepIndex(1)} total={totalSteps} onBack={() => setStep(0)} />
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

  if (step <= 2 && askLeaderboard) {
    return (
      <LeaderboardStep
        stepIndex={getStepIndex(2)}
        totalSteps={totalSteps}
        onBack={() => setStep(hasSemester ? 1 : 0)}
        onDone={() => setStep(3)}
      />
    );
  }

  return (
    <div class="onboard">
      <OnboardHeader
        current={totalSteps - 1}
        total={totalSteps}
        onBack={() => setStep(askLeaderboard ? 2 : hasSemester ? 1 : 0)}
      />
      <h1>Notifications</h1>
      <p>Uni Ranked asks "Did you attend?" when each class starts. Turn these on so the prompts arrive on time.</p>
      <PermissionRows />
      <button class="btn primary" onClick={() => dispatch(completeOnboarding)}>Finish</button>
    </div>
  );
}
