// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it, vi } from "vitest";
import { dispatch } from "../../store/store";
import { AchievementToast } from "./AchievementToast";

it("tapping the toast dismisses the queue", () => {
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => dispatch((s) => ({ ...s, achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z", "roll-call": "2026-10-01T00:00:00.000Z" } })));
  expect(root.textContent).toContain("Taking Inventory");
  act(() => root.querySelector<HTMLElement>(".adv-toast")!.click());
  expect(root.querySelector(".adv-toast")).toBeNull();
});

it("announces tiers, and legendary ones stay up longer", () => {
  vi.useFakeTimers();
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => dispatch((s) => ({ ...s, achievements: { flawless: "2026-10-01T00:00:00.000Z" } })));
  const toast = root.querySelector(".adv-toast")!;
  expect(toast.classList).toContain("legendary");
  expect(toast.textContent).toContain("Legendary achievement");
  expect(toast.querySelector("svg")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(4500); });
  expect(root.querySelector(".adv-toast")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(root.querySelector(".adv-toast")).toBeNull();
  act(() => dispatch((s) => ({ ...s, achievements: { ...s.achievements, "full-house": "2026-10-01T00:00:00.000Z" } })));
  expect(root.querySelector(".adv-toast")!.textContent).toContain("Rare achievement");
  render(null, root);
  vi.useRealTimers();
});
