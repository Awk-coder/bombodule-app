import { describe, expect, it } from "vitest";
import { TITLE_TEXTS, recordPeak, titleText, unlockedTitles } from "./titles";
import { makeState, result } from "./testState";

const now = new Date("2026-10-12T12:00:00+08:00");
const sem = (label: string) => ({ label, start: "2026-10-05", end: "2026-10-18" });

describe("recordPeak", () => {
  it("records the season's rank once rated, and only ever raises it", () => {
    const s = makeState({ results: [result("Sem 2, 2025/2026", [["X 1", "A"]])] }); // 4.00 → 2300, Netherite
    const a = recordPeak(s, now);
    expect(a.rankPeaks).toEqual({ "Sem 1, 2026/2027": "netherite" });
    const lower = { ...a, results: [result("Sem 2, 2025/2026", [["X 1", "C"]])] };
    expect(recordPeak(lower, now)).toBe(lower);
  });

  it("records nothing while unrated", () => {
    const s = makeState();
    expect(recordPeak(s, now)).toBe(s);
  });
});

describe("titles", () => {
  it("unlocks hand-picked achievement titles only", () => {
    const s = makeState({ achievements: { flawless: "x", "roll-call": "x" } });
    expect(unlockedTitles(s).map((t) => t.text)).toEqual(["Mr Perfect"]);
  });

  it("cooking achievements unlock chef titles", () => {
    const s = makeState({ achievements: { "master-baker": "x", "gordons-protege": "x", "we-need-to-cook": "x" } });
    expect(unlockedTitles(s).map((t) => t.text)).toEqual(["Master Baker", "Gordon's Protege"]);
    expect(TITLE_TEXTS).toContain("Gordon's Protege");
  });

  it("Netherite also unlocks the Diamond title", () => {
    const s = makeState({ rankPeaks: { "Sem 1, 2026/2027": "netherite" } });
    expect(unlockedTitles(s).map((t) => t.id)).toEqual(["rank-diamond", "rank-netherite"]);
  });

  it("a rank title stays plain through the next semester, then falls", () => {
    const peaks = { "Sem 1, 2025/2026": "netherite" as const, "Sem 2, 2025/2026": "gold" as const };
    expect(titleText(makeState({ semester: sem("Sem 1, 2025/2026"), rankPeaks: peaks }), "rank-netherite")).toBe("Netherite Grinder");
    expect(titleText(makeState({ semester: sem("Sem 2, 2025/2026"), rankPeaks: peaks }), "rank-netherite")).toBe("Netherite Grinder");
    expect(titleText(makeState({ semester: sem("Sem 1, 2026/2027"), rankPeaks: peaks }), "rank-netherite")).toBe("Fallen Netherite Grinder");
    expect(titleText(makeState({ semester: sem("Sem 1, 2026/2027"), rankPeaks: peaks }), "rank-diamond")).toBe("Fallen Diamond Hands");
  });

  it("reaching the rank again lifts the Fallen", () => {
    const peaks = { "Sem 1, 2025/2026": "diamond" as const, "Sem 2, 2025/2026": "gold" as const, "Sem 1, 2026/2027": "diamond" as const };
    expect(titleText(makeState({ semester: sem("Sem 1, 2026/2027"), rankPeaks: peaks }), "rank-diamond")).toBe("Diamond Hands");
  });

  it("has no text for a title you haven't unlocked", () => {
    expect(titleText(makeState(), "flawless")).toBeNull();
    expect(titleText(makeState(), "rank-diamond")).toBeNull();
  });

  it("lists every text the server may accept, Fallen ones included", () => {
    expect(TITLE_TEXTS).toContain("Mr Perfect");
    expect(TITLE_TEXTS).toContain("Fallen Netherite Grinder");
    expect(TITLE_TEXTS).not.toContain("Fallen Mr Perfect");
  });
});
