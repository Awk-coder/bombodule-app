import { registerPlugin } from "@capacitor/core";

export interface HadirPlugin {
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  openBatterySettings(): Promise<void>;
}

export const Hadir = registerPlugin<HadirPlugin>("Hadir", {
  web: () => import("./hadir.web").then((m) => new m.HadirWeb()),
});
