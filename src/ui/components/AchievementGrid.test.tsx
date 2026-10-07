// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { dispatch } from "../../store/store";
import { AchievementGrid } from "./AchievementGrid";

it("hides locked secrets and shows unlocked ones", () => {
  act(() => dispatch((s) => ({ ...s, achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z", objection: "2026-10-01T00:00:00.000Z" } })));
  const root = document.createElement("div");
  act(() => render(<AchievementGrid />, root));
  const text = root.textContent!;
  expect(text).toContain("Taking Inventory");
  expect(text).toContain("Objection!");
  expect(text).not.toContain("Voluntary Exile");
  expect(text).toContain("???");
  expect(text).toContain("2 / 46");
});

const tile = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLElement>(".adv")].find((b) => b.textContent?.includes(text))!;

it("shows a hint on locked secrets", () => {
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementGrid />, root));
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
  act(() => tile(root, "Ten Down").click());
  expect(root.querySelector(".sheet")!.textContent).toContain("0 / 10");
  root.remove();
});
