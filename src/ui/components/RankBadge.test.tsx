// @vitest-environment happy-dom
import { render } from "preact";
import { expect, it } from "vitest";
import { RankBadge, leakOf } from "./RankBadge";

const KINDS = ["unrated", "coal", "iron", "gold", "emerald", "diamond", "netherite"] as const;
const draw = (kind: (typeof KINDS)[number]) => {
  const root = document.createElement("div");
  render(<RankBadge kind={kind} />, root);
  return root;
};

it("draws the rank as crisp pixel art in its colour", () => {
  const root = draw("gold");
  const svg = root.querySelector("svg")!;
  expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
  expect(svg.querySelectorAll("path").length).toBeGreaterThan(3);
  expect(root.querySelector<HTMLElement>(".badge")!.style.getPropertyValue("--rank")).toBe("#f2b43a");
  expect(root.querySelector(".badge")!.getAttribute("aria-label")).toBe("Gold");
});

it("each rank has its own art", () => {
  expect(new Set(KINDS.map((k) => draw(k).querySelector("svg")!.innerHTML)).size).toBe(KINDS.length);
});

it("draws nothing on top of the art", () => {
  expect(draw("emerald").querySelector("circle, text")).toBeNull();
});

it("colour leak starts at Emerald and grows with rank and progress", () => {
  expect(leakOf("gold", 0.9)).toBe(0);
  expect(leakOf("emerald", 0)).toBeGreaterThan(0);
  expect(leakOf("emerald", 1)).toBeGreaterThan(leakOf("emerald", 0));
  expect(leakOf("diamond", 0)).toBeGreaterThan(leakOf("emerald", 1) - 0.001);
  expect(leakOf("netherite", 0)).toBeLessThanOrEqual(0.3);
});

it("renders diamond III with netherite corner pixels", () => {
  const normal = document.createElement("div");
  render(<RankBadge kind="diamond" div={2} />, normal);
  const d3 = document.createElement("div");
  render(<RankBadge kind="diamond" div={3} />, d3);
  expect(d3.innerHTML).not.toEqual(normal.innerHTML);
  expect(d3.querySelector('path[fill="#9f66b6"]')).not.toBeNull();
  expect(normal.querySelector('path[fill="#9f66b6"]')).toBeNull();
});
