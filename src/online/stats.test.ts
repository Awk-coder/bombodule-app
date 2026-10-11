import { describe, expect, it } from "vitest";
import { makeState, result } from "../domain/testState";
import { profileStats } from "./stats";

const now = new Date("2026-10-12T12:00:00+08:00");

describe("profileStats", () => {
  it("snapshots the season, degree rank and achievement count, never the CGPA", () => {
    const s = makeState({ results: [result("Sem 2, 2025/2026", [["X 1", "A"]])], achievements: { flawless: "x", "roll-call": "x" }, title: "flawless" });
    expect(profileStats(s, now)).toEqual({
      title: "Mr Perfect",
      stats: { season: "Sem 1, 2026/2027", rated: true, elo: 2300, degreeOre: "netherite", degreeTier: "S", achievements: 2 },
    });
  });

  it("sends no degree until it is ranked, and no title that isn't unlocked", () => {
    const s = makeState({ title: "flawless" });
    expect(profileStats(s, now)).toMatchObject({ title: null, stats: { rated: false, degreeOre: null, degreeTier: null } });
  });

  it("sends nothing without a semester", () => {
    expect(profileStats(makeState({ semester: undefined }), now)).toBeNull();
  });
});
