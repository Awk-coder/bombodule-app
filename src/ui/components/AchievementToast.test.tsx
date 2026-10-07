// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
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
