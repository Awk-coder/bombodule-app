// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { dispatch, getState } from "../../store/store";
import { ACHIEVEMENTS } from "../../domain/achievements";
import { AchievementGrid } from "./AchievementGrid";
import { AchievementToast } from "./AchievementToast";
import { LEGENDARY_ART } from "./achievementArt";

const showAll = (root: HTMLElement) => act(() => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.startsWith("Show all"))!.click());

it("hides locked secrets and shows unlocked ones", () => {
  act(() => dispatch((s) => ({ ...s, achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z", objection: "2026-10-01T00:00:00.000Z" } })));
  const root = document.createElement("div");
  act(() => render(<AchievementGrid />, root));
  showAll(root);
  const text = root.textContent!;
  expect(text).toContain("Taking Inventory");
  expect(text).toContain("Objection!");
  expect(text).not.toContain("Voluntary Exile");
  expect(text).toContain("???");
  expect(text).toContain("2 / 50");
});

const tile = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLElement>(".adv")].find((b) => b.textContent?.includes(text))!;

it("shows 8 at first, unlocked ones first and newest first, and expands to all", () => {
  act(() => dispatch((s) => ({ ...s, achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z", objection: "2026-10-03T00:00:00.000Z" } })));
  const root = document.createElement("div");
  act(() => render(<AchievementGrid />, root));
  const names = () => [...root.querySelectorAll(".adv b")].map((b) => b.textContent);
  expect(names()).toHaveLength(8);
  expect(names().slice(0, 2)).toEqual(["Objection!", "Taking Inventory"]);
  showAll(root);
  expect(names()).toHaveLength(50);
  act(() => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Show less")!.click());
  expect(names()).toHaveLength(8);
});

it("shows a hint on locked secrets", () => {
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementGrid />, root));
  showAll(root);
  expect(root.textContent).toContain("Too many empty seats");
});

it("opens details with unlock date or progress", () => {
  act(() => dispatch((s) => ({ ...s, tasks: [], achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z" } })));
  const root = document.createElement("div");
  document.body.append(root);
  act(() => render(<AchievementGrid />, root));
  act(() => tile(root, "Taking Inventory").click());
  expect(root.querySelector(".sheet")!.textContent).toContain("Unlocked 1 Oct 2026");
  act(() => (root.querySelector(".sheet-backdrop") as HTMLElement).click());
  showAll(root);
  act(() => tile(root, "Ten Down").click());
  expect(root.querySelector(".sheet")!.textContent).toContain("0 / 10");
  root.remove();
});

it("marks unlocked rare and legendary achievements with their art, and keeps locked ones plain", () => {
  act(() => dispatch((s) => ({ ...s, achievements: { "full-house": "2026-10-02T00:00:00.000Z", flawless: "2026-10-01T00:00:00.000Z" } })));
  const root = document.createElement("div");
  act(() => render(<AchievementGrid />, root));
  showAll(root);
  expect(tile(root, "Full House").classList).toContain("rare");
  expect(tile(root, "Full House").querySelector("svg")).not.toBeNull();
  expect(tile(root, "Flawless").classList).toContain("legendary");
  expect(tile(root, "Flawless").querySelector("svg")).not.toBeNull();
  const locked = tile(root, "Perfect Record");
  expect(locked.classList).not.toContain("legendary");
  expect(locked.querySelector("svg")).toBeNull();
});

it("has its own art for every legendary achievement", () => {
  expect(Object.keys(LEGENDARY_ART).sort()).toEqual(ACHIEVEMENTS.filter((a) => a.tier === "legendary").map((a) => a.id).sort());
});

it("replays the notification for an unlocked achievement, without changing anything", () => {
  act(() => dispatch((s) => ({ ...s, achievements: { "full-house": "2026-10-02T00:00:00.000Z" } })));
  const before = getState().achievements;
  const root = document.createElement("div");
  document.body.append(root);
  act(() => render(<><AchievementGrid /><AchievementToast /></>, root));
  showAll(root);
  act(() => tile(root, "Ten Down").click());
  expect([...root.querySelectorAll(".sheet button")].some((b) => b.textContent === "Replay")).toBe(false);
  act(() => (root.querySelector(".sheet-backdrop") as HTMLElement).click());
  act(() => tile(root, "Full House").click());
  expect(root.querySelector(".adv-toast")).toBeNull();
  act(() => [...root.querySelectorAll<HTMLElement>(".sheet button")].find((b) => b.textContent === "Replay")!.click());
  expect(root.querySelector(".adv-toast")!.textContent).toContain("Full House");
  expect(getState().achievements).toBe(before);
  render(null, root);
  root.remove();
});
