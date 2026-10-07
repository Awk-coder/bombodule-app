// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { getState } from "../../store/store";
import { Tasks } from "./Tasks";

it("tapping the empty Upcoming card opens a new task", () => {
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  const card = [...root.querySelectorAll<HTMLElement>(".card")].find((e) => e.textContent?.includes("Nothing due"))!;
  act(() => card.click());
  expect(root.textContent).toContain("New task");
});

it("saves a task as a Final assignment", () => {
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  act(() => root.querySelector<HTMLElement>(".fab")!.click());
  const title = root.querySelector<HTMLInputElement>("input[placeholder='Lab report 2']")!;
  act(() => {
    title.value = "Final project";
    title.dispatchEvent(new Event("input"));
  });
  act(() => root.querySelector<HTMLElement>(".final-row .toggle")!.click());
  act(() => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Save")!.click());
  expect(getState().tasks.find((x) => x.title === "Final project")?.final).toBe(true);
  expect(root.querySelector(".task-final")).not.toBeNull();
});
