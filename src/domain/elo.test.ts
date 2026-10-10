import { describe, expect, it } from "vitest";
import { seasonElo, taskGain } from "./elo";
import { makeState, result } from "./testState";
import type { Task } from "./types";

const now = new Date("2026-10-12T12:00:00+08:00");
const task = (id: string, due: string, over: Partial<Task> = {}): Task => ({ id, courseId: null, title: id, due: new Date(due).toISOString(), note: "", done: false, ...over });

describe("seasonElo", () => {
  it("is unrated at 900 without a previous slip", () => {
    expect(seasonElo(makeState(), now)).toMatchObject({ rated: false, placement: 900, elo: 900, changes: [] });
  });

  it("places from the latest earlier slip only", () => {
    const s = makeState({ results: [result("Sem 2, 2025/2026", [["X 1000", "C+"]]), result("Sem 1, 2026/2027", [["X 1000", "A"]])] });
    expect(seasonElo(s, now)).toMatchObject({ rated: true, placement: 798 }); // C+ 2.33 → 600 + 0.33/0.5·300
  });

  it("applies each delta", () => {
    const s = makeState({
      tasks: [
        task("on", "2026-10-09T23:59+08:00", { done: true, completedAt: new Date("2026-10-08T10:00+08:00").toISOString() }),
        task("fin", "2026-10-09T23:59+08:00", { done: true, final: true, completedAt: new Date("2026-10-09T10:00+08:00").toISOString() }),
        task("late", "2026-10-07T23:59+08:00", { done: true, completedAt: new Date("2026-10-08T10:00+08:00").toISOString() }),
        task("miss", "2026-10-10T23:59+08:00"),
        task("finmiss", "2026-10-11T23:59+08:00", { final: true }),
        task("future", "2026-10-20T23:59+08:00"),
        task("old", "2026-09-01T23:59+08:00", { done: true }),
        task("legacy", "2026-10-06T23:59+08:00", { done: true }),
      ],
    });
    const season = seasonElo(s, now);
    expect(Object.fromEntries(season.changes.map((c) => [c.taskId, c.delta]))).toEqual({ on: 3, fin: 18, late: -2, miss: -6, finmiss: -15, legacy: 3 });
    expect(season.elo).toBe(900 + 3 + 18 - 2 - 6 - 15 + 3);
    expect(season.changes[0].taskId).toBe("finmiss"); // newest first
  });

  it("never goes below zero", () => {
    const tasks = Array.from({ length: 80 }, (_, i) => task(`m${i}`, "2026-10-10T23:59+08:00", { final: true }));
    expect(seasonElo(makeState({ tasks }), now).elo).toBe(0);
  });

  it("caps short semester placement at Diamond III (max 1999)", () => {
    // 4.00 GPA in Sem 3 (short sem) normally would be 2300 (Netherite), but short sem caps at 1999
    const s = makeState({ results: [result("Sem 3, 2025/2026", [["X 1000", "A"]])] });
    expect(seasonElo(s, now).placement).toBe(1999);
  });

  it("awards credit load bonuses for heavy overload (> 18 credits)", () => {
    // 15 credits (<= 18) gets +0 overload bonus
    const courses5 = Array.from({ length: 5 }, (_, i): [string, string, number] => [`X ${i}`, "A", 3]);
    const s5 = makeState({ results: [result("Sem 2, 2025/2026", courses5)] });
    // A is 4.00 (base 2300) + 0 overload bonus = 2300
    expect(seasonElo(s5, now).placement).toBe(2300);

    // 18 credits (<= 18) gets +0 overload bonus
    const courses6 = Array.from({ length: 6 }, (_, i): [string, string, number] => [`X ${i}`, "A", 3]);
    const s6 = makeState({ results: [result("Sem 2, 2025/2026", courses6)] });
    expect(seasonElo(s6, now).placement).toBe(2300);

    // 21 credits (7 courses x 3 credits, 3 cr > 18) gets +30 overload bonus (10 * 3)
    const courses7 = Array.from({ length: 7 }, (_, i): [string, string, number] => [`X ${i}`, "A", 3]);
    const s7 = makeState({ results: [result("Sem 2, 2025/2026", courses7)] });
    expect(seasonElo(s7, now).placement).toBe(2330);
  });

  it("awards underdog comeback bonus only when leaping from <= 2.20 GPA, and strictly once", () => {
    // Sem 1 was 1.67 (D, <= 2.20), Sem 2 was 3.67 (A-): delta is +2.00 (>= 1.0)
    // 1 course x 3 credits has 0 load bonus, so base 1783 + 100 comeback bonus = 1883
    const s = makeState({
      results: [
        result("Sem 1, 2024/2025", [["X 1000", "D"]]),
        result("Sem 2, 2024/2025", [["X 1000", "A-"]]),
      ],
      tasks: [
        task("on1", "2026-10-09T23:59+08:00", { done: true, completedAt: "2026-10-08T10:00+08:00" }),
      ],
    });
    const season = seasonElo(s, now);
    expect(season.placement).toBe(1883);
    expect(season.comebackActive).toBe(true);
    // In Diamond (1883), base is 2. Task delta has 1.35x velocity: round(2 * 1.35) = 3
    expect(season.changes[0].delta).toBe(3);

    // When student advances to Sem 3 (e.g. 3.67 GPA), they already used their one-time comeback
    const sNext = makeState({
      results: [
        result("Sem 1, 2024/2025", [["X 1000", "D"]]),
        result("Sem 2, 2024/2025", [["X 1000", "A-"]]),
        result("Sem 1, 2025/2026", [["X 1000", "A-"]]),
      ],
    });
    const seasonNext = seasonElo(sNext, now);
    expect(seasonNext.placement).toBe(1783); // base only, no repeat comeback
    expect(seasonNext.comebackActive).toBe(false);

    // If previous GPA was > 2.20 (e.g., 2.67), no comeback bonus even if jumping >= 1.0
    const sNoComeback = makeState({
      results: [
        result("Sem 1, 2024/2025", [["X 1000", "B-"]]), // 2.67
        result("Sem 2, 2024/2025", [["X 1000", "A-"]]), // 3.67 (+1.00)
      ],
    });
    expect(seasonElo(sNoComeback, now).placement).toBe(1783);
    expect(seasonElo(sNoComeback, now).comebackActive).toBe(false);
  });

  it("caps positive task Elo gains at 5 tasks per calendar week", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task(`task_${i}`, "2026-10-09T23:59+08:00", {
        done: true,
        completedAt: `2026-10-0${i + 1}T10:00+08:00`,
      }),
    );
    const season = seasonElo(makeState({ tasks }), now);
    // 5 tasks get +3, 3 tasks get +0 (weekly cap)
    const deltas = season.changes.map((c) => c.delta);
    expect(deltas.filter((d) => d === 3)).toHaveLength(5);
    expect(deltas.filter((d) => d === 0)).toHaveLength(3);
    expect(season.changes.some((c) => c.title.includes("weekly cap"))).toBe(true);
  });

  it("applies diminishing returns across rank tiers (+3 under Emerald, +3 in Emerald, +2 in Diamond, +1 in Netherite)", () => {
    // Under Emerald (<1600): normal task gives +3, final gives +18
    expect(taskGain(1500, false)).toBe(3);
    expect(taskGain(1500, true)).toBe(18);

    // In Emerald (1600-1799): normal task gives +3, final gives +15
    expect(taskGain(1700, false)).toBe(3);
    expect(taskGain(1700, true)).toBe(15);

    // In Diamond (1800-1999): normal task gives +2, final gives +10
    expect(taskGain(1850, false)).toBe(2);
    expect(taskGain(1850, true)).toBe(10);

    // In Netherite (2000-2349): normal task gives +1, final gives +5
    expect(taskGain(2050, false)).toBe(1);
    expect(taskGain(2050, true)).toBe(5);
    expect(taskGain(2250, false)).toBe(1);
    expect(taskGain(2250, true)).toBe(5);

    // Peak tier (2350+): normal task gives +1, final gives +3
    expect(taskGain(2350, false)).toBe(1);
    expect(taskGain(2350, true)).toBe(3);
    expect(taskGain(2500, false)).toBe(1);
    expect(taskGain(2500, true)).toBe(3);
  });
});
