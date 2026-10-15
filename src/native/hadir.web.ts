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
  async canInstallApk() {
    return { value: false };
  }
  async openInstallPermissionSettings() {}
  async downloadAndInstall(options: { url: string }) {
    window.open(options.url, "_blank");
  }
  async downloadLiveUpdate() {
    return { success: false };
  }
  async reloadWebview() {
    window.location.reload();
  }
  async resetLiveUpdate() {}
  async getLiveUpdateVersion() {
    return { version: null };
  }
}
