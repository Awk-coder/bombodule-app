// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, expect, it } from "vitest";
import { result } from "../../domain/testState";
import { dispatch } from "../../store/store";
import { Ranked } from "./Ranked";

beforeEach(() => dispatch((s) => ({ ...s, results: [] })));

it("shows Unrated degree before any slip", () => {
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  expect(root.textContent).toContain("Import result slip");
  expect(root.querySelector(".degree")!.textContent).toContain("Unrated");
});

it("locks the degree and explains why when slips are missing", () => {
  const r = result("Sem 2, 2025/2026", [["BICS 4350", "B-"]], { printed: { gpa: 2.67, cgpa: 2.54, credits: 3, cumCredits: 68.5, cumPoints: 173.99 } });
  act(() => dispatch((s) => ({ ...s, results: [r] })));
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  expect(root.querySelector(".degree")!.textContent).toContain("earlier result slips");
  expect(root.querySelectorAll(".history .badge")).toHaveLength(1);
});

it("shows the degree tier when totals match", () => {
  act(() => dispatch((s) => ({ ...s, results: [result("Sem 1, 2025/2026", [["X 1000", "A"]])] })));
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  expect(root.querySelector(".degree")!.textContent).toContain("Netherite");
  expect(root.querySelector(".degree")!.textContent).toContain("4.00");
});
