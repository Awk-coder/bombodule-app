import { useState } from "preact/hooks";
import { applySync } from "../domain/actions";
import { ymd } from "../domain/time";
import type { ParsedSchedule } from "../iium/parser";
import { readSlip } from "../iium/sync";
import { dispatch } from "../store/store";

export function useSync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<ParsedSchedule | null>(null);
  const [progress, setProgress] = useState<{ message: string; percent?: number } | null>(null);

  async function start(file: Blob) {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      setPreview(
        await readSlip(file, (message, percent) => {
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

  function confirm(startNewSemester = false) {
    if (!preview) return;
    const parsed = preview;
    dispatch((s) => applySync(s, parsed, ymd(new Date()), startNewSemester));
    setPreview(null);
  }

  return {
    busy,
    error,
    preview,
    progress,
    start,
    confirm,
    cancel: () => setPreview(null),
  };
}

export type SyncState = ReturnType<typeof useSync>;
