import { describe, expect, it } from "vitest";
import { getShaderConfig, hexToRgb, ORE_PALETTES } from "./shaderPalette";

describe("shaderPalette", () => {
  it("converts hex to 0..1 RGB vectors", () => {
    expect(hexToRgb("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    const gold = hexToRgb("#d4af37");
    expect(gold[0]).toBeCloseTo(0.83, 1);
    expect(gold[1]).toBeCloseTo(0.68, 1);
    expect(gold[2]).toBeCloseTo(0.21, 1);
  });

  it("disables shader for coal tier", () => {
    const cfg = getShaderConfig("coal");
    expect(cfg.enabled).toBe(false);
    expect(cfg.opacity).toBe(0);
  });

  it("enforces super minimal effect for iron tier", () => {
    const cfg = getShaderConfig("iron");
    expect(cfg.enabled).toBe(true);
    expect(cfg.opacity).toBeLessThanOrEqual(0.2);
  });

  it("includes gold hints in diamond tier", () => {
    const cfg = getShaderConfig("diamond");
    expect(cfg.enabled).toBe(true);
    // color4 has high red & green (yellow/gold)
    const color4 = cfg.colors[3];
    expect(color4[0]).toBeGreaterThan(0.7); // red
    expect(color4[1]).toBeGreaterThan(0.6); // green
  });

  it("balances netherite opacity so components are not overshadowed", () => {
    const cfg = getShaderConfig("netherite");
    expect(cfg.enabled).toBe(true);
    expect(cfg.opacity).toBeLessThanOrEqual(0.5);
  });

  it("has configs for all ore types", () => {
    for (const ore of ["coal", "iron", "gold", "emerald", "diamond", "netherite"] as const) {
      expect(ORE_PALETTES[ore]).toBeDefined();
      expect(ORE_PALETTES[ore].colors).toHaveLength(4);
    }
  });
});
