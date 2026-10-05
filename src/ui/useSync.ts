import { useState } from "preact/hooks";
import { applySync } from "../domain/actions";
import { ymd } from "../domain/time";
import type { ParsedSchedule } from "../iium/parser";
import { CANCELLED, fetchTimetable } from "../iium/sync";
import { dispatch } from "../store/store";

export function useSync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<ParsedSchedule | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await fetchTimetable());
    } catch (e) {
      if ((e as Error).message !== CANCELLED) setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!preview) return;
    const parsed = preview;
    dispatch((s) => applySync(s, parsed, ymd(new Date())));
    setPreview(null);
  }

  return { busy, error, preview, start, confirm, cancel: () => setPreview(null) };
}

export type SyncState = ReturnType<typeof useSync>;
