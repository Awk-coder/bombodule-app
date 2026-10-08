import { useState } from "preact/hooks";
import { importResult } from "../domain/actions";
import type { ParsedResult } from "../iium/results";
import { readResultSlip } from "../iium/sync";
import { dispatch } from "../store/store";

export function useResultImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<ParsedResult | null>(null);
  const [progress, setProgress] = useState<{ message: string; percent?: number } | null>(null);

  async function start(file: Blob) {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      setPreview(
        await readResultSlip(file, (message, percent) => {
          setProgress({ message, percent });
        }),
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function confirm() {
    if (!preview) return;
    const parsed = preview;
    dispatch((s) => importResult(s, parsed, new Date()));
    setPreview(null);
  }

  function updatePreviewCourse(index: number, patch: Partial<ParsedResult["courses"][number]>) {
    if (!preview) return;
    const courses = [...preview.courses];
    courses[index] = { ...courses[index], ...patch };
    setPreview({ ...preview, courses });
  }

  return {
    busy,
    error,
    preview,
    progress,
    start,
    confirm,
    updatePreviewCourse,
    cancel: () => setPreview(null),
  };
}
