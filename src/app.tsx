import { App as CapApp } from "@capacitor/app";
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { Hadir } from "./native/hadir";
import { shareFile } from "./native/share";
import { useAppState, useLoadStatus } from "./store/store";
import { TabBar } from "./ui/components/TabBar";
import { go, parseHash, useRoute } from "./ui/router";
import type { Tab } from "./ui/router";
import { CourseDetail } from "./ui/screens/CourseDetail";
import { Courses } from "./ui/screens/Courses";
import { Home } from "./ui/screens/Home";
import { Onboarding } from "./ui/screens/Onboarding";
import { Schedule } from "./ui/screens/Schedule";
import { Settings } from "./ui/screens/Settings";
import { Tasks } from "./ui/screens/Tasks";
import { applyTheme } from "./ui/themes";

const SCREENS: Record<Tab, () => JSX.Element> = { home: Home, schedule: Schedule, tasks: Tasks, courses: Courses, settings: Settings };

function LoadError({ message, raw }: { message: string; raw: string }) {
  return (
    <div class="onboard">
      <h1>Couldn't load your data</h1>
      <p>{message}. Nothing has been changed or deleted. Export the saved data to keep a copy.</p>
      <button class="btn primary" onClick={() => void shareFile("hadir-raw.json", raw)}>Export saved data</button>
    </div>
  );
}

function useBackButton() {
  useEffect(() => {
    const handle = CapApp.addListener("backButton", () => {
      const r = parseHash(location.hash);
      if (r.courseId) history.back();
      else if (r.tab !== "home") go("#/home");
      else void CapApp.exitApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}

export function App() {
  const status = useLoadStatus();
  const state = useAppState();
  useBackButton();
  const theme = state.settings.theme;
  useEffect(() => {
    void Hadir.setLightBars({ light: applyTheme(theme).light }).catch(() => {});
  }, [theme]);
  const route = useRoute();

  if (!status.loaded) return <div class="screen"><div class="skeleton" /><div class="skeleton" /></div>;
  if (status.error) return <LoadError message={status.error} raw={status.raw ?? ""} />;
  if (!state.onboarded) return <Onboarding />;

  const Screen = SCREENS[route.tab];
  return (
    <>
      <main class={(route.tab === "schedule" || route.tab === "home") && !route.courseId ? "screen fill" : "screen"}>{route.courseId ? <CourseDetail id={route.courseId} /> : <Screen />}</main>
      <TabBar current={route.tab} />
    </>
  );
}
