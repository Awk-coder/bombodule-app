import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.awk.hadir",
  appName: "Bombodule",
  webDir: "dist",
  backgroundColor: "#101115",
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_hadir", iconColor: "#48DE7C" },
  },
};

export default config;
