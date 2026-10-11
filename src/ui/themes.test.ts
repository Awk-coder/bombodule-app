// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyTheme, themeById } from "./themes";

describe("applyTheme", () => {
  it("sets a theme's colors and clears them again for default dark", () => {
    const root = document.documentElement.style;
    document.body.style.background = "#0B0C0E";
    applyTheme("sand");
    expect(document.body.style.background).toBe("");
    expect(root.getPropertyValue("--bg")).toBe("#120f0d");
    expect(root.colorScheme).toBe("dark");
    applyTheme("dark");
    expect(root.getPropertyValue("--bg")).toBe("");
    expect(root.colorScheme).toBe("dark");
  });

  it("falls back to dark for an unknown id", () => {
    expect(themeById("nope").id).toBe("dark");
  });
});
