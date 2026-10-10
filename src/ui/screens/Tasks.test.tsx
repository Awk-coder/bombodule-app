// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { result } from "../../domain/testState";
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

const examsOver = (over = {}) => {
  const today = ymd(new Date());
  act(() => dispatch((s) => ({ ...s, results: [], examsDone: ["Sem 1, 2026/2027"], semester: { label: "Sem 1, 2026/2027", start: addDays(today, -100), end: addDays(today, -3) }, ...over })));
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  return root;
};

it("keeps finished exams pending until the result slip is imported", () => {
  const root = examsOver();
  expect(root.textContent).toContain("Waiting for your Sem 1, 2026/2027 result slip");
  expect(root.querySelector('.exams-card input[type="file"]')).not.toBeNull();
});

it("lets you undo Finished my last paper while pending", () => {
  const root = examsOver();
  const undo = [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Undo")!;
  act(() => undo.click());
  expect(getState().examsDone).toEqual([]);
});

it("drops the exams card once the slip is in", () => {
  const root = examsOver({ results: [result("Sem 1, 2026/2027", [["X 1", "A"]])] });
  expect(root.querySelector(".exams-card")).toBeNull();
});

it("hides final assignment tasks from Upcoming list until week 12 of semester", () => {
  const today = ymd(new Date());
  // Week 2: semester started 10 days ago, ends in 90 days
  act(() => dispatch((s) => ({
    ...s,
    semester: { label: "Sem 1, 2026/2027", start: addDays(today, -10), end: addDays(today, 90) },
    tasks: [
      { id: "reg", courseId: null, title: "Regular Quiz", due: addDays(today, 2), done: false, note: "" },
      { id: "fin", courseId: null, title: "Final Exam Paper", due: addDays(today, 60), done: false, final: true, note: "" },
    ],
  })));
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  expect(root.textContent).toContain("Regular Quiz");
  expect(root.textContent).not.toContain("Final Exam Paper");

  // Advance semester to week 12+: started 85 days ago
  act(() => dispatch((s) => ({
    ...s,
    semester: { label: "Sem 1, 2026/2027", start: addDays(today, -85), end: addDays(today, 15) },
  })));
  act(() => render(<Tasks />, root));
  expect(root.textContent).toContain("Final Exam Paper");
});

it("hides the Final assignment toggle in New task sheet before week 12", () => {
  const today = ymd(new Date());
  // Week 2: semester started 10 days ago, ends in 90 days
  act(() => dispatch((s) => ({
    ...s,
    semester: { label: "Sem 1, 2026/2027", start: addDays(today, -10), end: addDays(today, 90) },
  })));
  const root = document.createElement("div");
  act(() => render(<Tasks />, root));
  act(() => root.querySelector<HTMLElement>(".fab")!.click());
  expect(root.querySelector(".final-row")).toBeNull();

  // Week 12: started 85 days ago
  act(() => dispatch((s) => ({
    ...s,
    semester: { label: "Sem 1, 2026/2027", start: addDays(today, -85), end: addDays(today, 15) },
  })));
  act(() => render(<Tasks />, root));
  expect(root.querySelector(".final-row")).not.toBeNull();
});
