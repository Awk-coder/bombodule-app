import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { gpa, semesterMismatch, tierOf } from "../../domain/grades";
import type { ParsedResult } from "../../iium/results";
import { GRADE_POINTS, cleanOcrGrade } from "../../iium/correction";
import { titleCase } from "../format";
import { useResultImport } from "../useResultImport";
import { RankBadge } from "./RankBadge";
import { Sheet } from "./Sheet";

export function ResultPicker({ imp, label = "Import result slip" }: { imp: ReturnType<typeof useResultImport>; label?: string }) {
  return (
    <label class="btn primary" aria-disabled={imp.busy}>
      {imp.progress ? imp.progress.message : imp.busy ? "Reading…" : label}
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,.png,.jpg,.jpeg"
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

export function ResultSheet({
  r,
  onClose,
  onRemove,
  onUpdateCourse,
  children,
}: {
  r: ParsedResult;
  onClose: () => void;
  onRemove?: () => void;
  onUpdateCourse?: (index: number, patch: Partial<ParsedResult["courses"][number]>) => void;
  children?: ComponentChildren;
}) {
  const g = gpa(r.courses).gpa;
  const mismatch = semesterMismatch({ ...r, remarks: "", importedAt: "" });
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(Boolean(r.warnings && r.warnings.length > 0));

  return (
    <Sheet open onClose={onClose}>
      <div class="result-head">
        <RankBadge kind={tierOf(g).ore} size={48} />
        <div>
          <h2>{r.label}</h2>
          <p class="group-hint">GPA {g.toFixed(2)} · {tierOf(g).tier} tier{r.status ? ` · ${r.status}` : ""}</p>
        </div>
      </div>

      {r.warnings && r.warnings.length > 0 && (
        <div class="card" style="border: 1px solid #f2b43a; background: rgba(242, 180, 58, 0.08); margin-bottom: 12px;">
          <b style="color: #f2b43a; display: block; margin-bottom: 4px;">Please check and confirm:</b>
          {r.warnings.map((w) => (
            <p key={w} class="group-hint" style="color: #f2b43a; margin: 2px 0;">• {w}</p>
          ))}
        </div>
      )}

      {onUpdateCourse && (
        <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
          <button class="link" type="button" onClick={() => setEditing(!editing)}>
            {editing ? "Done editing" : "Edit courses"}
          </button>
        </div>
      )}

      {r.courses.map((c, i) => (
        <div class="row" key={`${c.code}-${i}`}>
          {editing && onUpdateCourse ? (
            <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
              <input
                style="width: 100px; padding: 4px 6px; font-size: 13px;"
                value={c.code}
                onInput={(e) => onUpdateCourse(i, { code: e.currentTarget.value })}
                placeholder="Code"
              />
              <div class="grow">
                <input
                  style="width: 100%; padding: 4px 6px; font-size: 13px;"
                  value={c.title}
                  onInput={(e) => onUpdateCourse(i, { title: e.currentTarget.value })}
                  placeholder="Title"
                />
              </div>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                style="width: 50px; padding: 4px 6px; font-size: 13px;"
                value={c.credits}
                onInput={(e) => onUpdateCourse(i, { credits: parseFloat(e.currentTarget.value) || 0 })}
                placeholder="Chr"
              />
              <input
                style="width: 50px; padding: 4px 6px; font-size: 13px; font-weight: bold; text-align: center;"
                value={c.grade}
                onInput={(e) => {
                  const val = cleanOcrGrade(e.currentTarget.value);
                  const pt = GRADE_POINTS[val] ?? null;
                  onUpdateCourse(i, { grade: val, point: pt });
                }}
                placeholder="Grade"
              />
            </div>
          ) : (
            <>
              <div class="grow">
                <b>{c.code}</b>
                <small>{titleCase(c.title)} ({c.credits} cr)</small>
              </div>
              <b>{c.grade}</b>
            </>
          )}
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
      {imp.progress && (
        <div class="card sync-progress" style="margin-top: 8px;">
          <p class="group-hint">{imp.progress.message}</p>
          {imp.progress.percent !== undefined && (
            <div class="adv-progress">
              <span style={{ width: `${imp.progress.percent}%` }} />
            </div>
          )}
        </div>
      )}
      {imp.error && <p class="error">{imp.error.message}</p>}
      {imp.preview && (
        <ResultSheet r={imp.preview} onClose={imp.cancel} onUpdateCourse={imp.updatePreviewCourse}>
          <button class="btn primary" onClick={imp.confirm}>Save result</button>
          <button class="btn ghost" onClick={imp.cancel}>Cancel</button>
        </ResultSheet>
      )}
    </>
  );
}
