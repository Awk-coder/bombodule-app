// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it, vi } from "vitest";
import { dispatch } from "../../store/store";
import { AchievementToast, replayToast } from "./AchievementToast";

it("tapping the toast slides it out and dismisses the queue", () => {
  vi.useFakeTimers();
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => dispatch((s) => ({ ...s, achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z", "roll-call": "2026-10-01T00:00:00.000Z" } })));
  expect(root.textContent).toContain("Taking Inventory");
  act(() => root.querySelector<HTMLElement>(".adv-toast")!.click());
  expect(root.querySelector(".adv-toast")!.classList).toContain("leaving");
  act(() => { vi.advanceTimersByTime(600); });
  act(() => { vi.advanceTimersByTime(400); });
  expect(root.querySelector(".adv-toast")).toBeNull();
  render(null, root);
  vi.useRealTimers();
});

it("slides out the way it came in before the next one shows", () => {
  vi.useFakeTimers();
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => dispatch((s) => ({ ...s, achievements: { "taking-inventory": "2026-10-01T00:00:00.000Z", "roll-call": "2026-10-01T00:00:00.000Z" } })));
  act(() => { vi.advanceTimersByTime(3900); });
  expect(root.querySelector(".adv-toast")!.classList).not.toContain("leaving");
  act(() => { vi.advanceTimersByTime(200); });
  expect(root.querySelector(".adv-toast")!.classList).toContain("leaving");
  expect(root.textContent).toContain("Taking Inventory");
  act(() => { vi.advanceTimersByTime(1000); });
  expect(root.textContent).toContain("Roll Call");
  expect(root.querySelector(".adv-toast")!.classList).not.toContain("leaving");
  render(null, root);
  vi.useRealTimers();
});

it("announces tiers, and rare ones stay up 6s and legendary ones 8s", () => {
  vi.useFakeTimers();
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => dispatch((s) => ({ ...s, achievements: { flawless: "2026-10-01T00:00:00.000Z" } })));
  const toast = root.querySelector(".adv-toast")!;
  expect(toast.classList).toContain("legendary");
  expect(toast.textContent).toContain("Legendary achievement");
  expect(toast.querySelector("svg")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(7500); });
  expect(root.querySelector(".adv-toast")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(600); }); // starts sliding out
  act(() => { vi.advanceTimersByTime(400); });
  expect(root.querySelector(".adv-toast")).toBeNull();
  act(() => dispatch((s) => ({ ...s, achievements: { ...s.achievements, "full-house": "2026-10-01T00:00:00.000Z" } })));
  expect(root.querySelector(".adv-toast")!.textContent).toContain("Rare achievement");
  act(() => { vi.advanceTimersByTime(5500); });
  expect(root.querySelector(".adv-toast")).not.toBeNull();
  act(() => { vi.advanceTimersByTime(600); });
  act(() => { vi.advanceTimersByTime(400); });
  expect(root.querySelector(".adv-toast")).toBeNull();
  render(null, root);
  vi.useRealTimers();
});

it("replaying the same achievement twice plays it twice", () => {
  vi.useFakeTimers();
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => { replayToast("roll-call"); replayToast("roll-call"); });
  const first = root.querySelector(".adv-toast")!;
  expect(first.textContent).toContain("Roll Call");
  act(() => { vi.advanceTimersByTime(4100); });
  act(() => { vi.advanceTimersByTime(400); });
  const second = root.querySelector(".adv-toast")!;
  expect(second.textContent).toContain("Roll Call");
  expect(second).not.toBe(first); // a fresh element, so it slides in again
  render(null, root);
  vi.useRealTimers();
});

it("immediately interrupts an active toast with fast slide-out when a new replay is triggered", () => {
  vi.useFakeTimers();
  act(() => dispatch((s) => ({ ...s, achievements: {} })));
  const root = document.createElement("div");
  act(() => render(<AchievementToast />, root));
  act(() => replayToast("taking-inventory"));
  expect(root.textContent).toContain("Taking Inventory");

  // While "Taking Inventory" is still playing, replay a different one
  act(() => replayToast("dont-be-a-bum"));
  expect(root.querySelector(".adv-toast")!.classList).toContain("leaving");
  expect(root.querySelector(".adv-toast")!.classList).toContain("fast");

  // Within fast exit time (160ms), it switches to the new toast
  act(() => { vi.advanceTimersByTime(200); });
  expect(root.textContent).toContain("Don't be a bum");
  expect(root.querySelector(".adv-toast")!.classList).not.toContain("leaving");
  render(null, root);
  vi.useRealTimers();
});
