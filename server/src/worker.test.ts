import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "./worker";
import type { D1 } from "./worker";
import { testDb } from "./testDb";

const SEASON = "Sem 1, 2026/2027";
let db: D1;
let clock = 1_000_000;

beforeEach(() => {
  db = testDb();
  clock += 60_000;
});

async function call(method: string, path: string, opts: { key?: string; body?: unknown; at?: number } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.key) headers.Authorization = `Bearer ${opts.key}`;
  const res = await handle(
    new Request(`https://api.test${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
    { DB: db },
    opts.at ?? clock,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

const stats = (elo: number, over = {}) => ({ season: SEASON, rated: true, elo, degreeOre: null, degreeTier: null, achievements: 3, ...over });

async function player(name: string, elo?: number) {
  const r = await call("POST", "/players", { body: { name } });
  expect(r.status).toBe(201);
  if (elo !== undefined) expect((await call("PATCH", "/me", { key: r.body.key, body: { stats: stats(elo) } })).status).toBe(204);
  return r.body as { id: string; key: string; name: string };
}

describe("profiles", () => {
  it("creates a profile with a secret key and finds it by that key", async () => {
    const p = await player("Wahid");
    expect(p.key.length).toBeGreaterThan(30);
    const me = await call("GET", "/me", { key: p.key });
    expect(me.body.player).toMatchObject({ id: p.id, name: "Wahid", group: null });
  });

  it("keeps names unique ignoring case", async () => {
    await player("Wahid");
    expect((await call("POST", "/players", { body: { name: "wahid" } })).status).toBe(409);
  });

  it("rejects bad names", async () => {
    for (const name of ["ab", "x".repeat(17), "<script>", ""]) expect((await call("POST", "/players", { body: { name } })).status).toBe(400);
  });

  it("renames and frees the old name", async () => {
    const p = await player("Wahid");
    expect((await call("PATCH", "/me", { key: p.key, body: { name: "Abdul" } })).status).toBe(204);
    await player("Wahid");
  });

  it("refuses requests without a valid key", async () => {
    expect((await call("GET", "/me")).status).toBe(401);
    expect((await call("GET", "/me", { key: "nope" })).status).toBe(401);
  });

  it("accepts only known titles", async () => {
    const p = await player("Wahid");
    expect((await call("PATCH", "/me", { key: p.key, body: { title: "Fallen Netherite Grinder" } })).status).toBe(204);
    expect((await call("PATCH", "/me", { key: p.key, body: { title: "Supreme Leader" }, at: clock + 20_000 })).status).toBe(400);
    expect((await call("PATCH", "/me", { key: p.key, body: { title: null }, at: clock + 40_000 })).status).toBe(204);
  });

  it("deletes a profile", async () => {
    const p = await player("Wahid");
    expect((await call("DELETE", "/me", { key: p.key })).status).toBe(204);
    expect((await call("GET", "/me", { key: p.key })).status).toBe(401);
    await player("Wahid");
  });

  it("reclaims an account on reinstall when matricHash matches", async () => {
    const matricHash = "a".repeat(64);
    const r1 = await call("POST", "/players", { body: { name: "Musa", matricHash } });
    expect(r1.status).toBe(201);
    const oldKey = r1.body.key;

    // A stranger tries to take the name with different or no matricHash -> 409
    expect((await call("POST", "/players", { body: { name: "Musa" } })).status).toBe(409);
    expect((await call("POST", "/players", { body: { name: "Musa", matricHash: "b".repeat(64) } })).status).toBe(409);

    // The student reinstalls and creates profile with same name and matching matricHash -> 200 reclaim!
    const r2 = await call("POST", "/players", { body: { name: "Musa", matricHash } });
    expect(r2.status).toBe(200);
    expect(r2.body.id).toBe(r1.body.id);
    expect(r2.body.name).toBe("Musa");
    expect(r2.body.key).not.toBe(oldKey);

    // Old key is revoked, new key works
    expect((await call("GET", "/me", { key: oldKey })).status).toBe(401);
    expect((await call("GET", "/me", { key: r2.body.key })).status).toBe(200);
  });
});

describe("stats", () => {
  it("rejects Elo outside 0–5000 and malformed stats", async () => {
    const p = await player("Wahid");
    for (const s of [stats(5001), stats(-1), stats(1.5), stats(900, { season: "next year" }), stats(900, { degreeOre: "gold" }), stats(900, { achievements: 500 })]) {
      expect((await call("PATCH", "/me", { key: p.key, body: { stats: s }, at: (clock += 20_000) })).status).toBe(400);
    }
  });

  it("allows one update per 10 seconds", async () => {
    const p = await player("Wahid");
    expect((await call("PATCH", "/me", { key: p.key, body: { stats: stats(900) }, at: clock })).status).toBe(204);
    expect((await call("PATCH", "/me", { key: p.key, body: { stats: stats(950) }, at: clock + 5_000 })).status).toBe(429);
    expect((await call("PATCH", "/me", { key: p.key, body: { stats: stats(950) }, at: clock + 10_000 })).status).toBe(204);
  });
});

describe("boards", () => {
  it("worldwide lists this season's players by Elo, unrated last, with the rank worked out from Elo", async () => {
    await player("Low", 700);
    await player("High", 2100);
    const u = await player("Fresh");
    await call("PATCH", "/me", { key: u.key, body: { stats: stats(2500, { rated: false }) } });
    const old = await player("Old");
    await call("PATCH", "/me", { key: old.key, body: { stats: stats(3000, { season: "Sem 2, 2025/2026" }) } });
    const r = await call("GET", `/board?scope=world&season=${encodeURIComponent(SEASON)}`);
    expect(r.body.players.map((p: { name: string }) => p.name)).toEqual(["High", "Low", "Fresh"]);
    expect(r.body.players[0]).toMatchObject({ elo: 2100, ore: "netherite", div: null, rated: true, achievements: 3 });
    expect(r.body.players[1]).toMatchObject({ ore: "iron", div: 2 });
  });

  it("numbers each player by board position, and search keeps those positions", async () => {
    await player("Alpha", 1500);
    await player("Bravo", 1200);
    await player("Alpaca", 900);
    await player("x_y_real", 800);
    const all = await call("GET", `/board?scope=world&season=${encodeURIComponent(SEASON)}`);
    expect(all.body.players.map((p: { pos: number }) => p.pos)).toEqual([1, 2, 3, 4]);
    const found = await call("GET", `/board?scope=world&season=${encodeURIComponent(SEASON)}&q=ALP`);
    expect(found.body.players.map((p: { name: string; pos: number }) => [p.name, p.pos])).toEqual([["Alpha", 1], ["Alpaca", 3]]);
    const literal = await call("GET", `/board?scope=world&season=${encodeURIComponent(SEASON)}&q=${encodeURIComponent("_")}`);
    expect(literal.body.players.map((p: { name: string }) => p.name)).toEqual(["x_y_real"]);
  });

  it("friends board shows only your group", async () => {
    const a = await player("Alpha", 1000);
    const b = await player("Bravo", 1200);
    await player("Stranger", 2000);
    const { code } = (await call("POST", "/groups", { key: a.key })).body;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect((await call("POST", "/groups/join", { key: b.key, body: { code: code.toLowerCase() } })).status).toBe(200);
    const r = await call("GET", `/board?scope=group&season=${encodeURIComponent(SEASON)}`, { key: a.key });
    expect(r.body.players.map((p: { name: string }) => p.name)).toEqual(["Bravo", "Alpha"]);
    expect((await call("GET", "/me", { key: b.key })).body.player.group).toBe(code);
  });

  it("joining a missing group is a 404, leaving the last member removes the group", async () => {
    const a = await player("Alpha");
    expect((await call("POST", "/groups/join", { key: a.key, body: { code: "ZZZZZZ" } })).status).toBe(404);
    const { code } = (await call("POST", "/groups", { key: a.key })).body;
    expect((await call("POST", "/groups/leave", { key: a.key })).status).toBe(204);
    const b = await player("Bravo");
    expect((await call("POST", "/groups/join", { key: b.key, body: { code } })).status).toBe(404);
  });

  it("group board without a group is empty", async () => {
    const a = await player("Alpha", 1000);
    const r = await call("GET", `/board?scope=group&season=${encodeURIComponent(SEASON)}`, { key: a.key });
    expect(r.body.players).toEqual([]);
  });

  it("shows one player's public profile", async () => {
    const a = await player("Alpha");
    await call("PATCH", "/me", { key: a.key, body: { title: "Mr Perfect", stats: stats(1600, { degreeOre: "diamond", degreeTier: "A", achievements: 12 }) } });
    const r = await call("GET", `/players/${a.id}`);
    expect(r.body).toEqual({ id: a.id, name: "Alpha", title: "Mr Perfect", season: SEASON, rated: true, elo: 1600, ore: "diamond", div: 1, degree: { ore: "diamond", tier: "A" }, achievements: 12 });
    expect((await call("GET", "/players/nobody")).status).toBe(404);
  });
});

describe("http", () => {
  it("answers CORS preflight and sets CORS on responses", async () => {
    const pre = await call("OPTIONS", "/me");
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect((await call("GET", "/nothing")).headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("404s unknown routes and 400s bad JSON", async () => {
    expect((await call("GET", "/nothing")).status).toBe(404);
    const res = await handle(new Request("https://api.test/players", { method: "POST", body: "{" }), { DB: db }, clock);
    expect(res.status).toBe(400);
  });
});
