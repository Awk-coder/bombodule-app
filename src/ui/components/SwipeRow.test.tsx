// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";
import { SwipeRow } from "./SwipeRow";

function setup() {
  const onRight = vi.fn();
  const onLeft = vi.fn();
  const root = document.createElement("div");
  document.body.appendChild(root);
  act(() => render(<SwipeRow onRight={onRight} onLeft={onLeft}><b>BICS 3301</b></SwipeRow>, root));
  const el = root.querySelector(".swipe-card") as HTMLElement;
  const drag = (dx: number, dy = 0) =>
    act(() => {
      el.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 100, pointerId: 1, bubbles: true }));
      el.dispatchEvent(new PointerEvent("pointermove", { clientX: 100 + dx / 2, clientY: 100 + dy / 2, pointerId: 1, bubbles: true }));
      el.dispatchEvent(new PointerEvent("pointermove", { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, bubbles: true }));
      el.dispatchEvent(new PointerEvent("pointerup", { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, bubbles: true }));
    });
  return { onRight, onLeft, drag };
}

describe("SwipeRow", () => {
  it("swiping right past the threshold fires onRight", async () => {
    const { onRight, onLeft, drag } = setup();
    drag(140);
    await vi.waitFor(() => expect(onRight).toHaveBeenCalledOnce());
    expect(onLeft).not.toHaveBeenCalled();
  });

  it("swiping left past the threshold fires onLeft", async () => {
    const { onRight, onLeft, drag } = setup();
    drag(-140);
    await vi.waitFor(() => expect(onLeft).toHaveBeenCalledOnce());
    expect(onRight).not.toHaveBeenCalled();
  });

  it("a short drag or a mostly vertical one does nothing", async () => {
    const { onRight, onLeft, drag } = setup();
    drag(40);
    drag(90, 200);
    await new Promise((r) => setTimeout(r, 400));
    expect(onRight).not.toHaveBeenCalled();
    expect(onLeft).not.toHaveBeenCalled();
  });
});
