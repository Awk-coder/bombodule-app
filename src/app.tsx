import type { JSX } from "preact";
import { shareFile } from "./native/share";
import { useAppState, useLoadStatus } from "./store/store";
import { TabBar } from "./ui/components/TabBar";
import { useRoute } from "./ui/router";
import type { Tab } from "./ui/router";
import { CourseDetail } from "./ui/screens/CourseDetail";
import { Courses } from "./ui/screens/Courses";
import { Home } from "./ui/screens/Home";
import { Schedule } from "./ui/screens/Schedule";
import { Settings } from "./ui/screens/Settings";
import { Tasks } from "./ui/screens/Tasks";

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

export function App() {
  const status = useLoadStatus();
  useAppState();
  const route = useRoute();

  if (!status.loaded) return <div class="screen"><div class="skeleton" /><div class="skeleton" /></div>;
  if (status.error) return <LoadError message={status.error} raw={status.raw ?? ""} />;

  const Screen = SCREENS[route.tab];
  return (
    <>
      <main class="screen">{route.courseId ? <CourseDetail id={route.courseId} /> : <Screen />}</main>
      <TabBar current={route.tab} />
    </>
  );
}
