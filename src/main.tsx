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

// Offline support for the web/home-screen build; the native shell serves files itself.
if (!Capacitor.isNativePlatform()) void import("virtual:pwa-register").then((m) => m.registerSW({ immediate: true }));

