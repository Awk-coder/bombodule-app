import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeState } from "../domain/testState";
import type { AppState } from "../domain/types";
import { startProfileSync } from "./sync";

const profile = { id: "p1", key: "secret", name: "Wahid" };
let state: AppState;
let changed: (() => void) | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

function start() {
  startProfileSync(() => state, (h) => (changed = () => h(state, state)));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_API_URL", "https://api.test");
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  state = makeState({ profile });
  changed = undefined;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sent = () => fetchMock.mock.calls.map(([url, init]) => ({ url, method: init.method, auth: init.headers.Authorization, body: JSON.parse(init.body) }));

describe("profile sync", () => {
  it("pushes stats once at start and again only when they change", async () => {
    start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(sent()).toEqual([{ url: "https://api.test/me", method: "PATCH", auth: "Bearer secret", body: expect.objectContaining({ stats: expect.objectContaining({ season: "Sem 1, 2026/2027" }) }) }]);
    changed!();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    state = { ...state, achievements: { flawless: "x" } };
    changed!();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a profile or without a server", async () => {
    state = makeState();
    start();
    await vi.advanceTimersByTimeAsync(3000);
    vi.stubEnv("VITE_API_URL", "");
    state = makeState({ profile });
    changed!();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tries again after a 429 or when offline", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 })).mockRejectedValueOnce(new TypeError("offline"));
    start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
