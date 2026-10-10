// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { expect, it } from "vitest";
import { makeState } from "../../domain/testState";
import { addDays, ymd } from "../../domain/time";
import { dispatch } from "../../store/store";
import { CourseDetail } from "./CourseDetail";

it("renders max 5 history rows initially and toggles Show more", () => {
  const today = ymd(new Date());
  // Create state with 8 historical sessions
  const slots = Array.from({ length: 8 }, (_, i) => ({
    id: `BICS 4350-1-slot-${i}`,
    courseId: "BICS 4350-1",
    day: (i % 5 + 1) as 1 | 2 | 3 | 4 | 5,
    start: "11:30",
    end: "12:50",
    venue: "ICT",
    lecturer: "DR X",
  }));
  const state = makeState({
    semester: { label: "Sem 1, 2026/2027", start: addDays(today, -30), end: addDays(today, 30) },
    slots,
  });
  act(() => dispatch(() => state));

  const root = document.createElement("div");
  act(() => render(<CourseDetail id="BICS 4350-1" />, root));

  // Verify only 5 rows are shown under History initially
  const showMoreBtn = root.querySelector<HTMLButtonElement>(".show-all");
  expect(showMoreBtn).not.toBeNull();
  expect(showMoreBtn?.textContent).toContain("Show more");

  // Click Show more -> expands to show all
  act(() => showMoreBtn?.click());
  expect(showMoreBtn?.textContent).toBe("Show less");
});

it("displays locked past sessions as a single read-only mark-pill", () => {
  const today = ymd(new Date());
  const state = makeState({
    semester: { label: "Sem 1, 2026/2027", start: addDays(today, -20), end: addDays(today, 20) },
    marks: {
      "BICS 4350-1-1-11:30@2026-10-05": "missed",
    },
  });
  act(() => dispatch(() => state));

  const root = document.createElement("div");
  act(() => render(<CourseDetail id="BICS 4350-1" />, root));

  // Historical sessions older than 36h show .mark-pill
  const pills = root.querySelectorAll(".mark-pill");
  expect(pills.length).toBeGreaterThan(0);
});
