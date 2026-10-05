import { Preferences } from "@capacitor/preferences";
import { useEffect, useState } from "preact/hooks";
import { emptyState } from "../domain/types";
import type { AppState } from "../domain/types";
import { parseImport, serialize } from "../domain/actions";

const KEY = "hadir-state";
type ChangeHook = (prev: AppState, next: AppState) => void;
interface LoadStatus {
  loaded: boolean;
  error: string | null;
  raw: string | null;
}

let state: AppState = emptyState();
let status: LoadStatus = { loaded: false, error: null, raw: null };
const listeners = new Set<() => void>();
const hooks: ChangeHook[] = [];

const emit = () => listeners.forEach((l) => l());

export async function loadState(): Promise<void> {
  const { value } = await Preferences.get({ key: KEY });
  if (value) {
    try {
      state = parseImport(value);
    } catch (e) {
      status = { loaded: true, error: (e as Error).message, raw: value };
      emit();
      return;
    }
  }
  status = { loaded: true, error: null, raw: null };
  emit();
}

export const getState = () => state;

export function dispatch(fn: (s: AppState) => AppState): void {
  if (status.error) return; // never overwrite data we couldn't read
  const prev = state;
  const next = fn(prev);
  if (next === prev) return;
  state = next;
  emit();
  void Preferences.set({ key: KEY, value: serialize(next) });
  hooks.forEach((h) => h(prev, next));
}

export function onStateChange(hook: ChangeHook): void {
  hooks.push(hook);
}

function useSubscribe<T>(read: () => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return read();
}

export const useAppState = () => useSubscribe(() => state);
export const useLoadStatus = () => useSubscribe(() => status);
