import { TIERS, rankOf } from "../../src/domain/grades";
import { TITLE_TEXTS } from "../../src/domain/titles";

/** The slice of Cloudflare's D1 API this worker uses. */
export interface D1 {
  prepare(sql: string): {
    bind(...args: (string | number | null)[]): D1Bound;
  } & D1Bound;
}
interface D1Bound {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Env {
  DB: D1;
}

interface Row {
  id: string;
  name: string;
  title: string | null;
  season: string | null;
  rated: number;
  elo: number;
  degree_ore: string | null;
  degree_tier: string | null;
  achievements: number;
  group_id: string | null;
  updated_at: number;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const NAME = /^[A-Za-z0-9_ ]{3,16}$/;
const SEASON = /^Sem [1-3], \d{4}\/\d{4}$/;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STATS_EVERY_MS = 10_000;
const BOARD_SIZE = 100;
const COLUMNS = "id, name, title, season, rated, elo, degree_ore, degree_tier, achievements, group_id, updated_at";

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const empty = (status = 204) => new Response(null, { status, headers: CORS });

function publicPlayer(r: Row) {
  const rank = r.rated ? rankOf(r.elo) : null;
  return {
    id: r.id,
    name: r.name,
    title: r.title,
    season: r.season,
    rated: !!r.rated,
    elo: r.elo,
    ore: rank?.ore ?? null,
    div: rank?.div ?? null,
    degree: r.degree_ore ? { ore: r.degree_ore, tier: r.degree_tier } : null,
    achievements: r.achievements,
  };
}

function randomString(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
}

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, "Bad JSON");
}

function checkName(name: unknown): string {
  if (typeof name !== "string" || !NAME.test(name.trim())) throw new HttpError(400, "Names are 3–16 letters, digits, spaces or underscores");
  return name.trim().replace(/ +/g, " ");
}

function isUnique(e: unknown) {
  return e instanceof Error && e.message.includes("UNIQUE");
}

async function me(req: Request, env: Env): Promise<Row> {
  const key = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (key) {
    const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM players WHERE key_hash = ?`).bind(await sha256(key)).first<Row>();
    if (row) return row;
  }
  throw new HttpError(401, "Unknown player");
}

async function groupCode(env: Env, groupId: string | null): Promise<string | null> {
  if (!groupId) return null;
  return (await env.DB.prepare("SELECT code FROM groups WHERE id = ?").bind(groupId).first<{ code: string }>())?.code ?? null;
}

/** Move a player to another group (or none), dropping the old group once nobody is left in it. */
async function moveTo(env: Env, player: Row, groupId: string | null) {
  await env.DB.prepare("UPDATE players SET group_id = ? WHERE id = ?").bind(groupId, player.id).run();
  if (player.group_id && player.group_id !== groupId) await dropIfEmpty(env, player.group_id);
}

async function dropIfEmpty(env: Env, groupId: string) {
  await env.DB.prepare("DELETE FROM groups WHERE id = ? AND NOT EXISTS (SELECT 1 FROM players WHERE group_id = ?)").bind(groupId, groupId).run();
}

function checkStats(s: unknown) {
  const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
  const ok =
    typeof o.season === "string" && SEASON.test(o.season) &&
    typeof o.rated === "boolean" &&
    Number.isInteger(o.elo) && (o.elo as number) >= 0 && (o.elo as number) <= 5000 &&
    Number.isInteger(o.achievements) && (o.achievements as number) >= 0 && (o.achievements as number) <= 200 &&
    ((o.degreeOre === null && o.degreeTier === null) || TIERS.some((t) => t.ore === o.degreeOre && t.tier === o.degreeTier));
  if (!ok) throw new HttpError(400, "Bad stats");
  return o as { season: string; rated: boolean; elo: number; achievements: number; degreeOre: string | null; degreeTier: string | null };
}

async function patchMe(req: Request, env: Env, now: number) {
  const player = await me(req, env);
  const b = await body(req);
  const name = b.name === undefined ? undefined : checkName(b.name);
  if (b.title !== undefined && b.title !== null && !(typeof b.title === "string" && TITLE_TEXTS.includes(b.title))) throw new HttpError(400, "Unknown title");
  const stats = b.stats === undefined ? undefined : checkStats(b.stats);
  if (stats && now - player.updated_at < STATS_EVERY_MS) throw new HttpError(429, "Too soon");

  if (name !== undefined) {
    try {
      await env.DB.prepare("UPDATE players SET name = ?, name_key = ? WHERE id = ?").bind(name, name.toLowerCase(), player.id).run();
    } catch (e) {
      if (isUnique(e)) throw new HttpError(409, "Name taken");
      throw e;
    }
  }
  if (b.title !== undefined) await env.DB.prepare("UPDATE players SET title = ? WHERE id = ?").bind(b.title as string | null, player.id).run();
  if (stats) {
    await env.DB.prepare("UPDATE players SET season = ?, rated = ?, elo = ?, degree_ore = ?, degree_tier = ?, achievements = ?, updated_at = ? WHERE id = ?")
      .bind(stats.season, stats.rated ? 1 : 0, stats.elo, stats.degreeOre, stats.degreeTier, stats.achievements, now, player.id)
      .run();
  }
  return empty();
}

async function route(req: Request, env: Env, now: number): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  if (m === "POST" && path === "/players") {
    const name = checkName((await body(req)).name);
    const id = crypto.randomUUID();
    const key = randomString(32);
    try {
      await env.DB.prepare("INSERT INTO players (id, name, name_key, key_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, name, name.toLowerCase(), await sha256(key), now)
        .run();
    } catch (e) {
      if (isUnique(e)) throw new HttpError(409, "Name taken");
      throw e;
    }
    return json({ id, key, name }, 201);
  }

  if (path === "/me") {
    if (m === "GET") {
      const p = await me(req, env);
      return json({ player: { ...publicPlayer(p), group: await groupCode(env, p.group_id) } });
    }
    if (m === "PATCH") return patchMe(req, env, now);
    if (m === "DELETE") {
      const p = await me(req, env);
      await env.DB.prepare("DELETE FROM players WHERE id = ?").bind(p.id).run();
      if (p.group_id) await dropIfEmpty(env, p.group_id);
      return empty();
    }
  }

  if (m === "POST" && path === "/groups") {
    const p = await me(req, env);
    for (let tries = 0; ; tries++) {
      const id = crypto.randomUUID();
      const code = randomCode();
      try {
        await env.DB.prepare("INSERT INTO groups (id, code, created_at) VALUES (?, ?, ?)").bind(id, code, now).run();
      } catch (e) {
        if (isUnique(e) && tries < 5) continue;
        throw e;
      }
      await moveTo(env, p, id);
      return json({ code });
    }
  }

  if (m === "POST" && path === "/groups/join") {
    const p = await me(req, env);
    const code = (await body(req)).code;
    const g = typeof code === "string" ? await env.DB.prepare("SELECT id, code FROM groups WHERE code = ?").bind(code.trim().toUpperCase()).first<{ id: string; code: string }>() : null;
    if (!g) throw new HttpError(404, "No group with that code");
    await moveTo(env, p, g.id);
    return json({ code: g.code });
  }

  if (m === "POST" && path === "/groups/leave") {
    await moveTo(env, await me(req, env), null);
    return empty();
  }

  if (m === "GET" && path === "/board") {
    const season = url.searchParams.get("season") ?? "";
    const order = `ORDER BY rated DESC, elo DESC, name_key LIMIT ${BOARD_SIZE}`;
    let rows: Row[];
    if (url.searchParams.get("scope") === "group") {
      const p = await me(req, env);
      if (!p.group_id) return json({ players: [] });
      rows = (await env.DB.prepare(`SELECT ${COLUMNS} FROM players WHERE season = ? AND group_id = ? ${order}`).bind(season, p.group_id).all<Row>()).results;
    } else {
      rows = (await env.DB.prepare(`SELECT ${COLUMNS} FROM players WHERE season = ? ${order}`).bind(season).all<Row>()).results;
    }
    return json({ players: rows.map(publicPlayer) });
  }

  const one = path.match(/^\/players\/([^/]+)$/);
  if (m === "GET" && one) {
    const r = await env.DB.prepare(`SELECT ${COLUMNS} FROM players WHERE id = ?`).bind(decodeURIComponent(one[1])).first<Row>();
    if (!r) throw new HttpError(404, "No such player");
    return json(publicPlayer(r));
  }

  throw new HttpError(404, "Not found");
}

export async function handle(req: Request, env: Env, now: number): Promise<Response> {
  if (req.method === "OPTIONS") return empty();
  try {
    return await route(req, env, now);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Server error" }, 500);
  }
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env, Date.now()),
};
