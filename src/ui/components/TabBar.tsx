import type { Tab } from "../router";
import { IconCalendar, IconCourses, IconHome, IconSettings, IconTasks } from "./icons";

const ITEMS = [
  { tab: "home", label: "Home", Icon: IconHome },
  { tab: "schedule", label: "Schedule", Icon: IconCalendar },
  { tab: "tasks", label: "Tasks", Icon: IconTasks },
  { tab: "courses", label: "Courses", Icon: IconCourses },
  { tab: "settings", label: "Settings", Icon: IconSettings },
] as const;

export function TabBar({ current }: { current: Tab }) {
  return (
    <nav class="tabbar">
      {ITEMS.map(({ tab, label, Icon }) => (
        <a key={tab} href={`#/${tab}`} class={`tab ${current === tab ? "active" : ""}`}>
          <Icon />
          {label}
        </a>
      ))}
    </nav>
  );
}
