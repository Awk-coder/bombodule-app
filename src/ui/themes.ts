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
    id: "sand", name: "Sand", swatch: ["#120f0d", "#241c16", "#e07a5f", "#f7f3ee"], light: false,
    vars: {
      "--bg": "#120f0d", "--surface": "#1b1613", "--border": "#2b231e", "--accent": "#e07a5f", "--accent-dim": "#331e17",
      "--hero": "#241c16", "--hero-outer": "#15110e", "--hero-line": "#3d2d23", "--track": "#28201a",
      "--text": "#f7f3ee", "--text-muted": "#9c9287", "--on-accent": "#1f0e08", "--missed": "#4a2420", "--warn": "#f59e0b",
    },
  },
  {
    id: "peach", name: "Peach", swatch: ["#140e11", "#261620", "#ff7b72", "#fdf2f4"], light: false,
    vars: {
      "--bg": "#140e11", "--surface": "#1d1419", "--border": "#2d1e27", "--accent": "#ff7b72", "--accent-dim": "#381b22",
      "--hero": "#261620", "--hero-outer": "#160e13", "--hero-line": "#422336", "--track": "#2a1b24",
      "--text": "#fdf2f4", "--text-muted": "#9e7e8b", "--on-accent": "#240910", "--missed": "#4d202e", "--warn": "#f59e0b",
    },
  },
  {
    id: "crimson", name: "Crimson", swatch: ["#110809", "#240f13", "#f43f5e", "#fbf1f2"], light: false,
    vars: {
      "--bg": "#110809", "--surface": "#1a0d0f", "--border": "#2b1417", "--accent": "#f43f5e", "--accent-dim": "#381217",
      "--hero": "#240f13", "--hero-outer": "#13090b", "--hero-line": "#3f181e", "--track": "#261115",
      "--text": "#fbf1f2", "--text-muted": "#9c787e", "--on-accent": "#200408", "--missed": "#481219", "--warn": "#f59e0b",
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
