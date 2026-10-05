export type ThemeId = "dark" | "royal" | "violet" | "ocean" | "sand" | "peach" | "crimson";

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
    id: "royal", name: "Royal", swatch: ["#0d0b1a", "#1e1838", "#e3b85c", "#f1edf9"], light: false,
    vars: {
      "--bg": "#0d0b1a", "--surface": "#16132a", "--border": "#262143", "--accent": "#e3b85c", "--accent-dim": "#2e2614",
      "--hero": "#1e1838", "--hero-outer": "#120f22", "--hero-line": "#3a2f63", "--track": "#2a2445",
      "--text": "#f1edf9", "--text-muted": "#8a84a3", "--on-accent": "#1a1306", "--missed": "#5b2b4a",
    },
  },
  {
    id: "violet", name: "Violet", swatch: ["#0c0c10", "#1a1630", "#a78bfa", "#f0f0f5"], light: false,
    vars: {
      "--bg": "#0c0c10", "--surface": "#15151b", "--border": "#24242d", "--accent": "#a78bfa", "--accent-dim": "#2a2342",
      "--hero": "#1a1630", "--hero-outer": "#111116", "--hero-line": "#352c5c", "--track": "#22202d",
      "--text": "#f0f0f5", "--text-muted": "#7f7f8c", "--on-accent": "#170f33", "--missed": "#4a2d4f",
    },
  },
  {
    id: "ocean", name: "Ocean", swatch: ["#071114", "#0b252b", "#38d6e0", "#eef7f8"], light: false,
    vars: {
      "--bg": "#071114", "--surface": "#0d1a1e", "--border": "#1a2a2f", "--accent": "#38d6e0", "--accent-dim": "#0f3238",
      "--hero": "#0b252b", "--hero-outer": "#0b161a", "--hero-line": "#17444c", "--track": "#15282d",
      "--text": "#eef7f8", "--text-muted": "#7a9195", "--on-accent": "#032226", "--missed": "#4f2a33",
    },
  },
  {
    id: "sand", name: "Sand", swatch: ["#f9f5ef", "#f6be55", "#a1453c", "#ababab"], light: true,
    vars: {
      "--bg": "#f9f5ef", "--surface": "#fffdf9", "--border": "#e9e0d2", "--accent": "#a1453c", "--accent-dim": "#fbe7c0",
      "--hero": "#fdf0d4", "--hero-outer": "#fffdf9", "--hero-line": "#f0d39a", "--track": "#efe4d2",
      "--text": "#2c2622", "--text-muted": "#8c8681", "--on-accent": "#ffffff", "--missed": "#d9a19b", "--warn": "#d18a0f",
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
