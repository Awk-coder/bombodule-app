// @vitest-environment happy-dom
import { render } from "preact";
import { expect, it } from "vitest";
import { loadState, useLoadStatus } from "./store";

function Probe() {
  return <p>{useLoadStatus().loaded ? "loaded" : "loading"}</p>;
}

it("re-renders when state finishes loading before effects have run", async () => {
  const root = document.createElement("div");
  render(<Probe />, root);
  await loadState();
  await new Promise((r) => setTimeout(r, 50));
  expect(root.textContent).toBe("loaded");
});
