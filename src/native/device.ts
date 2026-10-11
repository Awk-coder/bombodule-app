import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Hadir } from "./hadir";

export interface PermissionStatus {
  notifications: boolean;
  exactAlarms: boolean;
  battery: boolean;
}

export async function getPermissions(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) return { notifications: true, exactAlarms: true, battery: true };
  const [n, e, b] = await Promise.all([
    LocalNotifications.checkPermissions(),
    LocalNotifications.checkExactNotificationSetting(),
    Hadir.isIgnoringBatteryOptimizations(),
  ]);
  return { notifications: n.display === "granted", exactAlarms: e.exact_alarm === "granted", battery: b.value };
}

export const requestNotifications = () => LocalNotifications.requestPermissions();
export const openExactAlarmSettings = () => LocalNotifications.changeExactNotificationSetting();
export const openBatterySettings = () => Hadir.openBatterySettings();
