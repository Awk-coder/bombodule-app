import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.awk.hadir",
  appName: "Hadir",
  webDir: "dist",
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_hadir", iconColor: "#48DE7C" },
  },
};

export default config;
