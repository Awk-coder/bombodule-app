import type { AppState } from "../domain/types";
import { ApiError, apiUrl, call } from "./api";
import { profileStats } from "./stats";

const DEBOUNCE_MS = 2000;
const TOO_SOON_MS = 11_000;
const OFFLINE_MS = 30_000;

/** Keeps the server's copy of this player's stats and title current, pushing only what changed. */
export function startProfileSync(getState: () => AppState, onStateChange: (hook: (prev: AppState, next: AppState) => void) => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSent: string | null = null;
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void push(), ms);
  };

  async function push() {
    const state = getState();
    const payload = profileStats(state, new Date());
    if (!apiUrl() || !state.profile || !payload) return;
    const sending = JSON.stringify([state.profile.key, payload]);
    if (sending === lastSent) return;
    try {
      await call("/me", { method: "PATCH", key: state.profile.key, body: payload });
      lastSent = sending;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.status === 429) schedule(TOO_SOON_MS);
      else if (e.status === 0) schedule(OFFLINE_MS);
    }
  }

  onStateChange(() => schedule(DEBOUNCE_MS));
  schedule(DEBOUNCE_MS);
}
