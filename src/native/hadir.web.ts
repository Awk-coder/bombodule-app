import { WebPlugin } from "@capacitor/core";
import type { HadirPlugin } from "./hadir";

export class HadirWeb extends WebPlugin implements HadirPlugin {
  async isIgnoringBatteryOptimizations() {
    return { value: true };
  }
  async openBatterySettings() {}
  async setLightBars() {}
  async schedulePrompts() {}
  async takeAnswers() {
    return { answers: [] };
  }
}
