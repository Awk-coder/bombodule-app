import { App as CapApp } from "@capacitor/app";
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { recordAchievements } from "./domain/achievements";
import { seasonElo } from "./domain/elo";
import { rankOf } from "./domain/grades";
import { recordPeak } from "./domain/titles";
import { Hadir } from "./native/hadir";
import { shareFile } from "./native/share";
import { dispatch, useAppState, useLoadStatus } from "./store/store";
import { AchievementToast } from "./ui/components/AchievementToast";
import { ShaderGradientBackground } from "./ui/components/ShaderGradientBackground";
import { TabBar } from "./ui/components/TabBar";
import { go, parseHash, useRoute } from "./ui/router";
import type { Tab } from "./ui/router";
import { CourseDetail } from "./ui/screens/CourseDetail";
import { Courses } from "./ui/screens/Courses";
import { Home } from "./ui/screens/Home";
import { Onboarding } from "./ui/screens/Onboarding";
import { Ranked } from "./ui/screens/Ranked";
import { LeaderboardPage } from "./ui/components/Leaderboard";
import { Schedule } from "./ui/screens/Schedule";
import { Settings } from "./ui/screens/Settings";
import { Tasks } from "./ui/screens/Tasks";
import { applyTheme } from "./ui/themes";
import { useNow } from "./ui/useNow";

const SCREENS: Record<Tab, () => JSX.Element> = { home: Home, schedule: Schedule, tasks: Tasks, courses: Courses, ranked: Ranked, settings: Settings };

function LoadError({ message, raw }: { message: string; raw: string }) {
  return (
    <div class="onboard">
      <h1>Couldn't load your data</h1>
      <p>{message}. Nothing has been changed or deleted. Export the saved data to keep a copy.</p>
      <button class="btn primary" onClick={() => void shareFile("uni-ranked-raw.json", raw)}>Export saved data</button>
    </div>
  );
}

function useBackButton() {
  useEffect(() => {
    const handle = CapApp.addListener("backButton", () => {
      const r = parseHash(location.hash);
      if (r.courseId || r.board) history.back();
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
  const now = useNow();
  const season = seasonElo(state, now);
  const rank = rankOf(season.elo);
  const ore = season.rated ? rank.ore : "coal";

  // Per-screen fluid background settings (Schedule is explicitly 0/off for clean timetable contrast):
  const SCREEN_SHADERS: Record<Tab, { height: number; opacity: number }> = {
    ranked: { height: 660, opacity: 1.0 },
    home: { height: 380, opacity: 0.85 },
    tasks: { height: 300, opacity: 0.8 },
    courses: { height: 280, opacity: 0.75 },
    settings: { height: 300, opacity: 0.7 },
    schedule: { height: 0, opacity: 0 },
  };
  const shaderCfg = route.courseId || route.board ? { height: 0, opacity: 0 } : (SCREEN_SHADERS[route.tab] ?? { height: 0, opacity: 0 });

  useEffect(() => {
    if (status.loaded && !status.error && state.onboarded) dispatch((s) => recordPeak(recordAchievements(s, new Date()), new Date()));
  }, [state, now, status.loaded, status.error]);

  if (!status.loaded) return <div class="screen"><div class="skeleton" /><div class="skeleton" /></div>;
  if (status.error) return <LoadError message={status.error} raw={status.raw ?? ""} />;
  if (!state.onboarded) return <Onboarding />;

  const Screen = SCREENS[route.tab];
  return (
    <>
      <ShaderGradientBackground ore={ore} height={shaderCfg.height} opacity={shaderCfg.opacity} />
      <main class={(route.tab === "schedule" || route.tab === "home") && !route.courseId ? "screen fill" : "screen"}>
        {route.courseId ? <CourseDetail id={route.courseId} /> : route.board ? <LeaderboardPage /> : <Screen />}
      </main>
      <TabBar current={route.tab} />
      <AchievementToast />
    </>
  );
}
