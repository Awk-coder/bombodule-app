// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { Tasks } from "./Tasks";

it("tapping the empty Upcoming card opens a new task", () => {
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  const card = [...root.querySelectorAll<HTMLElement>(".card")].find((e) => e.textContent?.includes("Nothing due"))!;
  act(() => card.click());
  expect(root.textContent).toContain("New task");
});
