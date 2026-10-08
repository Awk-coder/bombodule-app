import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative paths so the same build runs in the native shell and under a GitHub Pages subpath.
  base: "./",
  plugins: [
    preact(),
    VitePWA({
      injectRegister: null, // registered in main.tsx, web only
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Uni Ranked",
        short_name: "Uni Ranked",
        description: "Class attendance, tasks and ranked GPA for IIUM students",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#0B0C0E",
        theme_color: "#0B0C0E",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,mjs,css,html,png,svg,woff,woff2}"], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
    }),
  ],
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx", "server/src/**/*.test.ts"] },
});
