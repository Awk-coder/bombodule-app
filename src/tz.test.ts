import { expect, it } from "vitest";

it("tests run in Malaysia time", () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-480);
});
