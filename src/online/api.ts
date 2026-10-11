import type { Ore, Tier } from "../domain/grades";
import { verifyTaskDeterministic } from "../domain/taskVerification";
import type { TaskVerificationResult } from "../domain/taskVerification";

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
  pos?: number; // place on the board it was listed on
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Computes SHA-256 hash of a student matric number for zero-knowledge identity reclaim. */
export async function hashMatric(matric: string | null | undefined): Promise<string | null> {
  if (!matric || !matric.trim()) return null;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(matric.trim()));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
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

/** Verifies academic legitimacy using Cloudflare Workers AI with deterministic fallback. */
export async function verifyTaskApi(
  title: string,
  courseCode?: string | null,
  courseName?: string | null,
): Promise<TaskVerificationResult> {
  const server = apiUrl();
  if (!server) {
    return verifyTaskDeterministic(title, courseCode);
  }
  try {
    return await call<TaskVerificationResult>("/tasks/verify", {
      method: "POST",
      body: { title, courseCode, courseName },
    });
  } catch {
    return verifyTaskDeterministic(title, courseCode);
  }
}
