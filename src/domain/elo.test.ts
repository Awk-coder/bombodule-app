import { describe, expect, it } from "vitest";
import { seasonElo } from "./elo";
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
    expect(Object.fromEntries(season.changes.map((c) => [c.taskId, c.delta]))).toEqual({ on: 15, fin: 45, late: -10, miss: -20, finmiss: -60, legacy: 15 });
    expect(season.elo).toBe(900 + 15 + 45 - 10 - 20 - 60 + 15);
    expect(season.changes[0].taskId).toBe("finmiss"); // newest first
  });

  it("never goes below zero", () => {
    const tasks = Array.from({ length: 20 }, (_, i) => task(`m${i}`, "2026-10-10T23:59+08:00", { final: true }));
    expect(seasonElo(makeState({ tasks }), now).elo).toBe(0);
  });
});
