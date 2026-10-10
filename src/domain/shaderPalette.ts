import type { Ore } from "./grades";

export interface ShaderConfig {
  enabled: boolean;
  colors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  speed: number;
  frequency: number;
  strength: number;
  opacity: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export const ORE_PALETTES: Record<Ore, ShaderConfig> = {
  // Coal: pure dark, no effects
  coal: {
    enabled: false,
    colors: [
      hexToRgb("#08090a"),
      hexToRgb("#101214"),
      hexToRgb("#16181b"),
      hexToRgb("#1f2328"),
    ],
    speed: 0.1,
    frequency: 1.0,
    strength: 1.0,
    opacity: 0.0,
  },

  // Iron: super minimal, barely visible cold slate
  iron: {
    enabled: true,
    colors: [
      hexToRgb("#0a0c0e"),
      hexToRgb("#12151a"),
      hexToRgb("#181c22"),
      hexToRgb("#2a3240"),
    ],
    speed: 0.15,
    frequency: 1.2,
    strength: 0.8,
    opacity: 0.15,
  },

  // Gold: warm molten gold & bronze embers
  gold: {
    enabled: true,
    colors: [
      hexToRgb("#120d04"),
      hexToRgb("#281b07"),
      hexToRgb("#543c10"),
      hexToRgb("#d4af37"),
    ],
    speed: 0.25,
    frequency: 1.4,
    strength: 1.2,
    opacity: 0.42,
  },

  // Emerald: slight but visible forest emerald waves rising through the dark
  emerald: {
    enabled: true,
    colors: [
      hexToRgb("#06140b"),
      hexToRgb("#0c2818"),
      hexToRgb("#194d2f"),
      hexToRgb("#2dc653"),
    ],
    speed: 0.3,
    frequency: 1.5,
    strength: 1.3,
    opacity: 0.5,
  },

  // Diamond: crystalline cyan/turquoise waves with swirling hints of golden amber
  diamond: {
    enabled: true,
    colors: [
      hexToRgb("#05161f"),
      hexToRgb("#0d384a"),
      hexToRgb("#2693a6"),
      hexToRgb("#e2b542"), // hints of light gold
    ],
    speed: 0.35,
    frequency: 1.6,
    strength: 1.4,
    opacity: 0.55,
  },

  // Netherite: cosmic obsidian void, imperial amethyst & radiant lilac — balanced so UI is never overshadowed
  netherite: {
    enabled: true,
    colors: [
      hexToRgb("#09040e"),
      hexToRgb("#1a082b"),
      hexToRgb("#3d145c"),
      hexToRgb("#a855f7"),
    ],
    speed: 0.35,
    frequency: 1.5,
    strength: 1.3,
    opacity: 0.48,
  },
};

export function getShaderConfig(ore: Ore): ShaderConfig {
  return ORE_PALETTES[ore] ?? ORE_PALETTES.coal;
}
