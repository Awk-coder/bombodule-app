// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { addDays, ymd } from "../../domain/time";
import { dispatch, getState } from "../../store/store";
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

it("offers Finished my last paper after classes end, once", () => {
  const today = ymd(new Date());
  act(() => dispatch((s) => ({ ...s, examsDone: [], semester: { label: "Sem 1, 2026/2027", start: addDays(today, -100), end: addDays(today, -3) } })));
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  const btn = [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Finished my last paper"))!;
  act(() => btn.click());
  expect(getState().examsDone).toEqual(["Sem 1, 2026/2027"]);
  expect(root.textContent).not.toContain("Finished my last paper");
});

it("lets you undo Finished my last paper", () => {
  const today = ymd(new Date());
  act(() => dispatch((s) => ({ ...s, examsDone: ["Sem 1, 2026/2027"], semester: { label: "Sem 1, 2026/2027", start: addDays(today, -100), end: addDays(today, -3) } })));
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  const undo = [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Undo"))!;
  act(() => undo.click());
  expect(getState().examsDone).toEqual([]);
});
