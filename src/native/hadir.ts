import { registerPlugin } from "@capacitor/core";

export interface HadirPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  openBatterySettings(): Promise<void>;
  setLightBars(options: { light: boolean }): Promise<void>; // dark status/nav bar icons for light themes
}

export const Hadir = registerPlugin<HadirPlugin>("Hadir", {
  web: () => import("./hadir.web").then((m) => new m.HadirWeb()),
});
