import { useState } from "preact/hooks";
import { importResult } from "../domain/actions";
import type { ParsedResult } from "../iium/results";
import { readResultSlip } from "../iium/sync";
import { dispatch } from "../store/store";

export function useResultImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<ParsedResult | null>(null);

  async function start(file: Blob) {
    setBusy(true);
    setError(null);
    try {
      setPreview(await readResultSlip(file));
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!preview) return;
    const parsed = preview;
    dispatch((s) => importResult(s, parsed, new Date()));
    setPreview(null);
  }

  return { busy, error, preview, start, confirm, cancel: () => setPreview(null) };
}
