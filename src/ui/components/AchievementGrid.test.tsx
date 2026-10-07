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
