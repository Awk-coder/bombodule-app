// @vitest-environment happy-dom
import { render } from "preact";
import { expect, it } from "vitest";
import { BADGES, RankBadge } from "./RankBadge";

it("every badge is a 15×15 grid using only the legend", () => {
  for (const [kind, rows] of Object.entries(BADGES)) {
    expect(rows, kind).toHaveLength(15);
    for (const r of rows) expect(r, kind).toMatch(/^[.oabcw]{15}$/);
  }
});

it("ore badges are mirror-symmetric", () => {
  for (const [kind, rows] of Object.entries(BADGES)) {
    if (kind === "unrated") continue;
    for (const r of rows) expect(r, kind).toBe([...r].reverse().join(""));
  }
});

it("renders one rect per filled pixel", () => {
  const root = document.createElement("div");
  render(<RankBadge kind="gold" />, root);
  const filled = BADGES.gold.join("").replace(/\./g, "").length;
  expect(root.querySelectorAll("rect")).toHaveLength(filled);
});
