import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** A class prompt or absence warning, shown as the custom card notification. */
export interface PromptItem {
  id: number;
  at: number; // epoch ms
  kind: "attendance" | "warning";
  sessionId: string;
  title: string;
  body: string;
  route: string;
  // card fields, attendance only
  code?: string;
  name?: string;
  venue?: string;
  time?: string;
  missed?: number;
  limit?: number;
  color?: number;
  autoMiss?: boolean;
}

export interface HadirPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  openBatterySettings(): Promise<void>;
  setLightBars(options: { light: boolean }): Promise<void>; // dark status/nav bar icons for light themes
  schedulePrompts(options: { items: PromptItem[] }): Promise<void>; // replaces everything scheduled before
  /** Answers given on prompt cards since the last call, and the route of the last tapped one. */
  takeAnswers(): Promise<{ answers: { sessionId: string; mark: string }[]; route?: string }>;
  addListener(event: "answer", fn: () => void): Promise<PluginListenerHandle>; // a card was answered while the app runs
}

export const Hadir = registerPlugin<HadirPlugin>("Hadir", {
  web: () => import("./hadir.web").then((m) => new m.HadirWeb()),
});
