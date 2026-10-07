import { useEffect, useState } from "preact/hooks";

export type Tab = "home" | "schedule" | "tasks" | "courses" | "ranked" | "settings";
export interface Route {
  tab: Tab;
  courseId?: string;
}

const TABS: Tab[] = ["home", "schedule", "tasks", "courses", "ranked", "settings"];

export function parseHash(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, "").split("/");
  if (a === "course" && b) return { tab: "courses", courseId: decodeURIComponent(b) };
  return { tab: (TABS as string[]).includes(a) ? (a as Tab) : "home" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = path;
};

export const courseHref = (id: string) => `#/course/${encodeURIComponent(id)}`;
