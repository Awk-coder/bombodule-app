// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, expect, it } from "vitest";
import { result } from "../../domain/testState";
import { dispatch, getState } from "../../store/store";
import { Ranked } from "./Ranked";

beforeEach(() => {
  dispatch((s) => ({ ...s, results: [], tasks: [], graduated: undefined, achievements: {}, rankPeaks: {}, title: undefined }));
  localStorage.clear();
});

const mount = () => {
  const root = document.createElement("div");
  act(() => render(<Ranked />, root));
  return root;
};
const button = (root: HTMLElement, t: string) => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes(t))!;

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
  expect(season.textContent).toContain("906");
  expect(season.textContent).toContain("Gold I");
  expect(season.textContent).toContain("+6");
  expect(season.querySelector(".season-elo")!.textContent).toBe("906");
  expect(season.querySelector(".badge")!.textContent).toBe("");
  expect(season.querySelector(".elo-bar")).toBeNull();
});

it("offers graduating only after the semester's last paper", () => {
  const sem = { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2027-02-01" };
  act(() => dispatch((s) => ({ ...s, graduated: undefined, semester: sem, examsDone: [], results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
  expect(button(mount(), "I've graduated")).toBeUndefined();
  act(() => dispatch((s) => ({ ...s, examsDone: [sem.label] })));
  expect(button(mount(), "I've graduated")).toBeTruthy();
});

it("asks before marking you graduated", () => {
  act(() => dispatch((s) => ({ ...s, graduated: undefined, semester: null, results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
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

it("explains how ranking works with the full ladder", () => {
  const root = mount();
  act(() => button(root, "How ranking works").click());
  const sheet = root.querySelector(".sheet")!.textContent!;
  for (const t of ["+6", "+18", "-4", "-12", "-30", "Emerald", "1200", "Netherite", "2000", "each semester"]) expect(sheet).toContain(t);
  expect(root.querySelectorAll(".sheet .badge").length).toBe(6);
});

it("tells you how to get placed while unrated", () => {
  expect(mount().querySelector(".season")!.textContent).toContain("Import last semester's slip to get placed");
});

it("removes a result from its sheet after confirming", () => {
  act(() => dispatch((s) => ({ ...s, results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
  const root = mount();
  act(() => (root.querySelector(".history-item") as HTMLElement).click());
  expect(root.querySelector(".sheet .badge")).not.toBeNull();
  act(() => button(root, "Remove result").click());
  expect(getState().results).toHaveLength(1);
  act(() => button(root, "Yes, remove").click());
  expect(getState().results).toHaveLength(0);
});

it("lets you undo graduating", () => {
  act(() => dispatch((s) => ({ ...s, graduated: "2026-10-01T00:00:00.000Z", results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
  const root = mount();
  expect(button(root, "I've graduated")).toBeUndefined();
  act(() => button(root, "Undo graduation").click());
  expect(getState().graduated).toBeUndefined();
});

it("says when you ranked up or down", () => {
  act(() => dispatch((s) => ({ ...s, results: [result("Sem 2, 2025/2026", [["X 1", "B"]])] })));
  localStorage.setItem("uni-ranked-last-rank-key", "gold-1");
  expect(mount().textContent).toContain("Promoted to Emerald I");
  localStorage.setItem("uni-ranked-last-rank-key", "diamond-1");
  expect(mount().textContent).toContain("Dropped to Emerald I");
});

it("shows four Elo changes until you ask for all", () => {
  const due = new Date(Date.now() - 86_400_000).toISOString();
  const tasks = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `t${i}`, courseId: null, title: `Task ${i}`, due, note: "", done: true }));
  act(() => dispatch((s) => ({ ...s, tasks })));
  const root = mount();
  expect(root.querySelectorAll(".elo-change")).toHaveLength(4);
  act(() => button(root, "Show all 6").click());
  expect(root.querySelectorAll(".elo-change")).toHaveLength(6);
});

it("reminds you results only live on this phone", () => {
  act(() => dispatch((s) => ({ ...s, results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
  expect(mount().querySelector('a[href="#/settings"]')).not.toBeNull();
});

it("keeps graduation pending until the last semester's slip is in", () => {
  act(() => dispatch((s) => ({ ...s, graduated: "2026-10-01T00:00:00.000Z", semester: { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2026-10-18" }, results: [result("Sem 2, 2025/2026", [["BICS 4350", "B-"]])] })));
  const root = mount();
  expect(root.textContent).toContain("Graduation pending");
  expect(root.textContent).toContain("Sem 1, 2026/2027 result slip");
  act(() => dispatch((s) => ({ ...s, results: [...s.results, result("Sem 1, 2026/2027", [["X 1", "A"]])] })));
  expect(root.textContent).not.toContain("Graduation pending");
  act(() => dispatch((s) => ({ ...s, semester: null })));
});

it("shows the chosen title under the season rank, Fallen when it has lapsed", () => {
  act(() => dispatch((s) => ({ ...s, achievements: { flawless: "x" }, title: "flawless" })));
  expect(mount().querySelector(".season-title")!.textContent).toBe("Mr Perfect");
  act(() => dispatch((s) => ({ ...s, semester: { label: "Sem 1, 2026/2027", start: "2026-10-05", end: "2027-02-01" }, rankPeaks: { "Sem 1, 2025/2026": "netherite", "Sem 2, 2025/2026": "gold" }, title: "rank-netherite" })));
  expect(mount().querySelector(".season-title")!.textContent).toBe("Fallen Netherite Grinder");
  act(() => dispatch((s) => ({ ...s, title: undefined })));
  expect(mount().querySelector(".season-title")).toBeNull();
});
