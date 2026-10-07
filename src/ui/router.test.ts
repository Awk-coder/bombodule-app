import { expect, it } from "vitest";
import { courseHref, parseHash } from "./router";

it("parses hashes", () => {
  expect(parseHash("")).toEqual({ tab: "home" });
  expect(parseHash("#/tasks")).toEqual({ tab: "tasks" });
  expect(parseHash("#/ranked")).toEqual({ tab: "ranked" });
  expect(parseHash("#/nope")).toEqual({ tab: "home" });
  expect(parseHash(courseHref("BICS 4350-1"))).toEqual({ tab: "courses", courseId: "BICS 4350-1" });
});
