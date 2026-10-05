import { useState } from "preact/hooks";
import { completeOnboarding, setSemesterEnd } from "../../domain/actions";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate } from "../format";
import { useSync } from "../useSync";
import { IconClock } from "../components/icons";
import { PermissionRows } from "../components/PermissionRows";
import { SlipPicker, SyncErrorCard, SyncPreviewSheet } from "../components/SyncParts";

export function Onboarding() {
  const state = useAppState();
  const sync = useSync();
  const [step, setStep] = useState(0);
  const linked = state.courses.some((c) => c.active);

  if (step === 0) {
    return (
      <div class="onboard">
        <div class="logo"><IconClock size={30} /></div>
        <h1>Bombodule</h1>
        <p>Track attendance and tasks for your IIUM classes, so you never get barred.</p>
        <p>In i-Ma'luum, open your Course Registration Confirmation Slip and print it to PDF. Import that file and Bombodule builds your timetable.</p>
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

  return (
    <div class="onboard">
      <h1>Notifications</h1>
      <p>Bombodule asks "Did you attend?" after each class. Turn these on so the prompts arrive on time.</p>
      <PermissionRows />
      <button class="btn primary" onClick={() => dispatch(completeOnboarding)}>Finish</button>
    </div>
  );
}
