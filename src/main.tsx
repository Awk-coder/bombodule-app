import "@fontsource/libre-baskerville/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./ui/theme.css";
import { render } from "preact";
import { App } from "./app";
import { boot } from "./boot";

render(<App />, document.getElementById("app")!);
void boot();

