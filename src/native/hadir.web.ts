import { WebPlugin } from "@capacitor/core";
import type { HadirPlugin } from "./hadir";

export class HadirWeb extends WebPlugin implements HadirPlugin {
  async casLogin() {
    return { cookie: "dev" };
  }
  async clearCookies() {}
  async isIgnoringBatteryOptimizations() {
    return { value: true };
  }
  async openBatterySettings() {}
}
