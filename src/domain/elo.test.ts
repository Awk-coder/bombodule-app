import { describe, expect, it } from "vitest";
import { seasonElo, taskGain } from "./elo";
import { makeState, result } from "./testState";
import type { Task } from "./types";

const now = new Date("2026-10-12T12:00:00+08:00");
const task = (id: string, due: string, over: Partial<Task> = {}): Task => ({ id, courseId: null, title: id, due: new Date(due).toISOString(), note: "", done: false, ...over });

describe("seasonElo", () => {
  it("is unrated at 900 without a previous slip", () => {
    expect(seasonElo(makeState(), now)).toEqual({ rated: false, placement: 900, elo: 900, changes: [] });
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
    expect(Object.fromEntries(season.changes.map((c) => [c.taskId, c.delta]))).toEqual({ on: 6, fin: 18, late: -4, miss: -12, finmiss: -30, legacy: 6 });
    expect(season.elo).toBe(900 + 6 + 18 - 4 - 12 - 30 + 6);
    expect(season.changes[0].taskId).toBe("finmiss"); // newest first
  });

  it("never goes below zero", () => {
    const tasks = Array.from({ length: 40 }, (_, i) => task(`m${i}`, "2026-10-10T23:59+08:00", { final: true }));
    expect(seasonElo(makeState({ tasks }), now).elo).toBe(0);
  });

  it("caps short semester placement at Diamond III (max 1999)", () => {
    // 4.00 GPA in Sem 3 (short sem) normally would be 2300 (Netherite), but short sem caps at 1999
    const s = makeState({ results: [result("Sem 3, 2025/2026", [["X 1000", "A"]])] });
    expect(seasonElo(s, now).placement).toBe(1999);
  });

  it("awards credit load bonuses for heavy semesters", () => {
    // 15 credits (5 courses x 3 credits) gets +80 load bonus
    const courses5 = Array.from({ length: 5 }, (_, i): [string, string, number] => [`X ${i}`, "A", 3]);
    const s5 = makeState({ results: [result("Sem 2, 2025/2026", courses5)] });
    // A is 4.00 (base 2300) + 80 load bonus = 2380
    expect(seasonElo(s5, now).placement).toBe(2380);

    // 21 credits (7 courses x 3 credits) gets +120 overload bonus
    const courses7 = Array.from({ length: 7 }, (_, i): [string, string, number] => [`X ${i}`, "A", 3]);
    const s7 = makeState({ results: [result("Sem 2, 2025/2026", courses7)] });
    expect(seasonElo(s7, now).placement).toBe(2420);
  });

  it("awards underdog comeback bonus and 1.35x task velocity when jumping >= 1.0 GPA", () => {
    // Sem 1 was 1.67 (D), Sem 2 was 3.67 (A-): delta is +2.00 (>= 1.0)
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
    // Task delta has 1.35x velocity: round(6 * 1.35) = 8
    expect(season.changes[0].delta).toBe(8);
  });

  it("caps positive task Elo gains at 5 tasks per calendar week", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task(`task_${i}`, "2026-10-09T23:59+08:00", {
        done: true,
        completedAt: `2026-10-0${i + 1}T10:00+08:00`,
      }),
    );
    const season = seasonElo(makeState({ tasks }), now);
    // 5 tasks get +6, 3 tasks get +0 (weekly cap)
    const deltas = season.changes.map((c) => c.delta);
    expect(deltas.filter((d) => d === 6)).toHaveLength(5);
    expect(deltas.filter((d) => d === 0)).toHaveLength(3);
    expect(season.changes.some((c) => c.title.includes("weekly cap"))).toBe(true);
  });

  it("applies diminishing returns in Netherite (+4) and past 2300 (+2)", () => {
    // Below Netherite (<2000): normal task gives +6, final gives +18
    expect(taskGain(1500, false)).toBe(6);
    expect(taskGain(1500, true)).toBe(18);

    // In Netherite (2000-2299): normal task gives +4, final gives +12
    expect(taskGain(2050, false)).toBe(4);
    expect(taskGain(2050, true)).toBe(12);

    // Peak tier (2300+): normal task gives +2, final gives +6 (super slow progression)
    expect(taskGain(2350, false)).toBe(2);
    expect(taskGain(2350, true)).toBe(6);
  });
});
