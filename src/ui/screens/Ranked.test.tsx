// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, expect, it } from "vitest";
import { result } from "../../domain/testState";
import { dispatch, getState } from "../../store/store";
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
  expect(root.querySelector(".degree")!.textContent).toContain("Import the slips before");
  expect(root.querySelectorAll(".history .badge")).toHaveLength(1);
  expect(root.querySelector(".history-item")!.textContent).toContain("2.67");
});

it("shows the degree tier when totals match", () => {
  act(() => dispatch((s) => ({ ...s, results: [result("Sem 1, 2025/2026", [["X 1000", "A"]])] })));
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  expect(root.querySelector(".degree")!.textContent).toContain("Netherite");
  expect(root.querySelector(".degree")!.textContent).toContain("4.00");
  expect(root.querySelector(".degree .badge")!.textContent).toBe("");
});

it("shows the season rank, Elo and recent changes", () => {
  const due = new Date(Date.now() - 86_400_000).toISOString();
  act(() => dispatch((s) => ({ ...s, results: [], tasks: [{ id: "x", courseId: null, title: "Lab 1", due, note: "", done: true, completedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }] })));
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  const season = root.querySelector(".season")!;
  expect(season.textContent).toContain("915");
  expect(season.textContent).toContain("Gold I");
  expect(season.textContent).toContain("+15");
  expect(season.querySelector(".season-elo")!.textContent).toBe("915");
  expect(season.querySelector(".badge")!.textContent).toBe("");
  expect(season.querySelector(".elo-bar")).toBeNull();
});

it("asks before marking you graduated", () => {
  act(() => dispatch((s) => ({ ...s, graduated: undefined, results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  const find = (t: string) => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === t);
  act(() => find("I've graduated")!.click());
  expect(getState().graduated).toBeUndefined();
  act(() => find("Cancel")!.click());
  expect(getState().graduated).toBeUndefined();
  act(() => find("I've graduated")!.click());
  act(() => find("Yes, I've graduated")!.click());
  expect(getState().graduated).toBeTruthy();
});
