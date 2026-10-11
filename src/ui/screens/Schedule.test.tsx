// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { makeState } from "../../domain/testState";
import { dispatch, getState } from "../../store/store";
import { Schedule } from "./Schedule";

let root: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 5, 7), toFake: ["setTimeout", "clearTimeout", "Date"] });
  dispatch(() => makeState());
  root = document.createElement("div");
  act(() => render(<Schedule />, root));
});

afterEach(() => {
  act(() => render(null, root));
  vi.useRealTimers();
});

const bicsMon = () => [...root.querySelectorAll<HTMLElement>(".block")].find((b) => b.textContent?.includes("BICS 4350"))!;
const press = (el: HTMLElement, ms: number) => {
  act(() => void el.dispatchEvent(new PointerEvent("pointerdown", { clientX: 10, clientY: 10, pointerId: 1, bubbles: true })));
  act(() => void vi.advanceTimersByTime(ms));
  act(() => {
    el.dispatchEvent(new PointerEvent("pointerup", { clientX: 10, clientY: 10, pointerId: 1, bubbles: true }));
    el.click();
  });
};

it("holding a class for 5 seconds offers its scheduled dates as the actual start", () => {
  press(bicsMon(), 5000);
  expect(root.textContent).toContain("Actual start");
  expect(root.textContent).not.toContain("Open course");
  const chips = [...root.querySelectorAll<HTMLElement>(".chips button")];
  expect(chips.map((c) => c.textContent).slice(0, 3)).toEqual(["Mon 5 Oct", "Wed 7 Oct", "Mon 12 Oct"]);
  act(() => chips[1].click());
  expect(getState().courses.find((c) => c.id === "BICS 4350-1")?.startFrom).toBe("2026-10-07");
  expect(root.textContent).not.toContain("Actual start");
});

it("picking the first scheduled date clears a late start", () => {
  press(bicsMon(), 5000);
  act(() => root.querySelectorAll<HTMLElement>(".chips button")[1].click());
  press(bicsMon(), 5000);
  act(() => root.querySelectorAll<HTMLElement>(".chips button")[0].click());
  expect(getState().courses.find((c) => c.id === "BICS 4350-1")?.startFrom).toBeUndefined();
});

it("a shorter press is a normal tap", () => {
  press(bicsMon(), 4000);
  expect(root.textContent).not.toContain("Actual start");
  expect(root.textContent).toContain("Open course");
});

it("shows night classes, stretching the grid to 10pm", () => {
  act(() => dispatch((s) => ({ ...s, slots: [...s.slots, { ...s.slots[0], id: "night", day: 4, start: "20:30", end: "21:50" }] })));
  const night = [...root.querySelectorAll<HTMLElement>(".block")].filter((b) => b.textContent?.includes("BICS 4350"));
  expect(night.length).toBe(3);
  const labels = [...root.querySelectorAll(".hour-line span")].map((l) => l.textContent);
  expect(labels.at(-1)).toBe("22:00");
});
