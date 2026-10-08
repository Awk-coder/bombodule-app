import "@fontsource/libre-baskerville/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./ui/theme.css";
import { Capacitor } from "@capacitor/core";
import { render } from "preact";
import { App } from "./app";
import { boot } from "./boot";

render(<App />, document.getElementById("app")!);
void boot();

// Offline support for the web/home-screen build; automatically reloads when an update is ready.
if (!Capacitor.isNativePlatform()) {
  let refreshing = false;
  navigator?.serviceWorker?.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
  void import("virtual:pwa-register").then((m) => m.registerSW({ immediate: true }));
}

