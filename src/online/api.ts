import type { Ore, Tier } from "../domain/grades";

/** Base URL of the leaderboard server; empty when this build has none, which hides every online feature. */
export const apiUrl = () => ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

export interface PublicPlayer {
  id: string;
  name: string;
  title: string | null;
  season: string | null;
  rated: boolean;
  elo: number;
  ore: Ore | null;
  div: 1 | 2 | 3 | null;
  degree: { ore: Ore; tier: Tier } | null;
  achievements: number;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function call<T = void>(path: string, opts: { method?: string; key?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.key) headers.Authorization = `Bearer ${opts.key}`;
  let res: Response;
  try {
    res = await fetch(apiUrl() + path, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (!res.ok) {
    const msg = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    throw new ApiError(res.status, msg ?? `Server error (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
