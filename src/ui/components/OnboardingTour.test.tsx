// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { dispatch, getState } from "../../store/store";
import { OnboardingTour, TOUR_STORAGE_KEY } from "./OnboardingTour";

const roots: HTMLElement[] = [];
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  localStorage.clear();
  dispatch((s) => ({ ...s, onboarded: true, tourCompleted: false }));
});

afterEach(() => {
  roots.splice(0).forEach((r) => render(null, r));
});

it("renders tour sheet when user is onboarded and has not completed tour", async () => {
  const root = document.createElement("div");
  roots.push(root);
  await act(async () => render(<OnboardingTour />, root));
  await act(async () => new Promise((r) => setTimeout(r, 450)));
  await settle();

  expect(root.querySelector(".tour-sheet")).not.toBeNull();
  expect(root.textContent).toContain("Daily Attendance");
});

it("completes tour when clicking skip", async () => {
  const root = document.createElement("div");
  roots.push(root);
  await act(async () => render(<OnboardingTour />, root));
  await act(async () => new Promise((r) => setTimeout(r, 450)));
  await settle();

  const skipBtn = root.querySelector<HTMLButtonElement>(".tour-skip-btn");
  expect(skipBtn).not.toBeNull();
  await act(async () => skipBtn!.click());
  await settle();

  expect(getState().tourCompleted).toBe(true);
  expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("true");
});
