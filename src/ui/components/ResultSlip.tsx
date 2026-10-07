import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { gpa, semesterMismatch, tierOf } from "../../domain/grades";
import type { ParsedResult } from "../../iium/results";
import { titleCase } from "../format";
import { useResultImport } from "../useResultImport";
import { RankBadge } from "./RankBadge";
import { Sheet } from "./Sheet";

export function ResultPicker({ imp, label = "Import result slip" }: { imp: ReturnType<typeof useResultImport>; label?: string }) {
  return (
    <label class="btn primary" aria-disabled={imp.busy}>
      {imp.busy ? "Reading…" : label}
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

export function ResultSheet({ r, onClose, onRemove, children }: { r: ParsedResult; onClose: () => void; onRemove?: () => void; children?: ComponentChildren }) {
  const g = gpa(r.courses).gpa;
  const mismatch = semesterMismatch({ ...r, remarks: "", importedAt: "" });
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet open onClose={onClose}>
      <div class="result-head">
        <RankBadge kind={tierOf(g).ore} size={48} />
        <div>
          <h2>{r.label}</h2>
          <p class="group-hint">GPA {g.toFixed(2)} · {tierOf(g).tier} tier{r.status ? ` · ${r.status}` : ""}</p>
        </div>
      </div>
      {r.courses.map((c) => (
        <div class="row" key={c.code}>
          <div class="grow"><b>{c.code}</b><small>{titleCase(c.title)}</small></div>
          <b>{c.grade}</b>
        </div>
      ))}
      {mismatch && <p class="error">{mismatch}</p>}
      {children}
      {onRemove && !confirm && <button class="btn ghost danger" onClick={() => setConfirm(true)}>Remove result</button>}
      {onRemove && confirm && (
        <>
          <p class="group-hint">Remove {r.label}? You can import the slip again later.</p>
          <button class="btn primary danger" onClick={onRemove}>Yes, remove</button>
          <button class="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}

/** Picker, preview sheet and error in one, for importing a slip outside the Ranked screen. */
export function ImportSlip({ label }: { label: string }) {
  const imp = useResultImport();
  return (
    <>
      <ResultPicker imp={imp} label={label} />
      {imp.error && <p class="error">{imp.error.message}</p>}
      {imp.preview && (
        <ResultSheet r={imp.preview} onClose={imp.cancel}>
          <button class="btn primary" onClick={imp.confirm}>Save result</button>
          <button class="btn ghost" onClick={imp.cancel}>Cancel</button>
        </ResultSheet>
      )}
    </>
  );
}
