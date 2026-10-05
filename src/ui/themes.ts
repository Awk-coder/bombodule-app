export type ThemeId = "dark" | "sand" | "mint" | "peach" | "crimson" | "pop" | "slate";

interface Theme {
  id: ThemeId;
  name: string;
  swatch: [string, string, string, string];
  light: boolean;
  vars: Record<string, string>; // overrides of the :root tokens in theme.css
}

export const THEMES: Theme[] = [
  { id: "dark", name: "Dark", swatch: ["#0b0c0e", "#15331f", "#48de7c", "#f2f2f2"], light: false, vars: {} },
  {
    id: "sand", name: "Sand", swatch: ["#f9f5ef", "#f6be55", "#a1453c", "#ababab"], light: true,
    vars: {
      "--bg": "#f9f5ef", "--surface": "#fffdf9", "--border": "#e9e0d2", "--accent": "#a1453c", "--accent-dim": "#fbe7c0",
      "--hero": "#fdf0d4", "--hero-outer": "#fffdf9", "--hero-line": "#f0d39a", "--track": "#efe4d2",
      "--text": "#2c2622", "--text-muted": "#8c8681", "--on-accent": "#ffffff", "--missed": "#d9a19b", "--warn": "#d18a0f",
    },
  },
  {
    id: "mint", name: "Mint", swatch: ["#f7fbfa", "#c8fcd5", "#78d2c3", "#6993d6"], light: true,
    vars: {
      "--bg": "#f7fbfa", "--surface": "#ffffff", "--border": "#dcebe6", "--accent": "#4a78c4", "--accent-dim": "#d4f9de",
      "--hero": "#e3faea", "--hero-outer": "#ffffff", "--hero-line": "#a9e3d8", "--track": "#d9eee8",
      "--text": "#1f2d3a", "--text-muted": "#7d8a94", "--on-accent": "#ffffff", "--missed": "#e6a8ab", "--warn": "#d18a0f",
    },
  },
  {
    id: "peach", name: "Peach", swatch: ["#fdd0be", "#e8857f", "#e0605e", "#4a2e12"], light: true,
    vars: {
      "--bg": "#fde6dc", "--surface": "#fff4ef", "--border": "#f5c9b8", "--accent": "#c94a48", "--accent-dim": "#f9c9bf",
      "--hero": "#fdd0be", "--hero-outer": "#fff4ef", "--hero-line": "#e8857f", "--track": "#f6b8a6",
      "--text": "#4a2e12", "--text-muted": "#9a6f5c", "--on-accent": "#ffffff", "--missed": "#8a5a3c", "--warn": "#b86e00",
      "--danger": "#4a2e12", "--danger-bg": "#f5d9c6",
    },
  },
  {
    id: "crimson", name: "Crimson", swatch: ["#ede8db", "#850000", "#6a0000", "#1b1919"], light: true,
    vars: {
      "--bg": "#ede8db", "--surface": "#f6f2e8", "--border": "#dcd4c3", "--accent": "#850000", "--accent-dim": "#e6d3c8",
      "--hero": "#f3e6dc", "--hero-outer": "#f6f2e8", "--hero-line": "#c99a8f", "--track": "#e2d6c9",
      "--text": "#1b1919", "--text-muted": "#7a746a", "--on-accent": "#ffffff", "--missed": "#1b1919", "--warn": "#b86e00",
      "--danger": "#6a0000", "--danger-bg": "#f0d6d0",
    },
  },
  {
    id: "pop", name: "Pop", swatch: ["#f31160", "#f6f2a7", "#f6c224", "#208e7b"], light: true,
    vars: {
      "--bg": "#fbf9d8", "--surface": "#fffef0", "--border": "#ede8a8", "--accent": "#208e7b", "--accent-dim": "#d3eee6",
      "--hero": "#f6f2a7", "--hero-outer": "#fffef0", "--hero-line": "#f6c224", "--track": "#ece58a",
      "--text": "#14332d", "--text-muted": "#7c7a55", "--on-accent": "#ffffff", "--missed": "#f31160", "--warn": "#c98f00",
      "--danger": "#f31160", "--danger-bg": "#fde0ea",
    },
  },
  {
    id: "slate", name: "Slate", swatch: ["#ededed", "#eb911b", "#3a4651", "#2f3640"], light: true,
    vars: {
      "--bg": "#ededed", "--surface": "#f8f8f8", "--border": "#d8d9db", "--accent": "#c46f00", "--accent-dim": "#f9e2c2",
      "--hero": "#fbf0e1", "--hero-outer": "#f8f8f8", "--hero-line": "#e9c48f", "--track": "#e0e2e5",
      "--text": "#2f3640", "--text-muted": "#7b828b", "--on-accent": "#ffffff", "--missed": "#3a4651", "--warn": "#c46f00",
    },
  },
];

export const themeById = (id: string | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0];

const ALL_VARS = [...new Set(THEMES.flatMap((t) => Object.keys(t.vars)))];

export function applyTheme(id: string | undefined) {
  const t = themeById(id);
  const root = document.documentElement.style;
  for (const v of ALL_VARS) root.removeProperty(v);
  for (const [k, v] of Object.entries(t.vars)) root.setProperty(k, v);
  root.colorScheme = t.light ? "light" : "dark";
  document.body.style.removeProperty("background"); // index.html's pre-load dark fill would cover light themes
  return t;
}
