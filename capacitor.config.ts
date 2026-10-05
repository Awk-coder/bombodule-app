import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.awk.hadir",
  appName: "Hadir",
  webDir: "dist",
  backgroundColor: "#0B0C0E",
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_hadir", iconColor: "#48DE7C" },
  },
};

export default config;
