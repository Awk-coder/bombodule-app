import html from "../../tests/fixtures/schedule.html?raw";
import { applySync, markSession } from "../domain/actions";
import { generateSessions } from "../domain/sessions";
import { addDays, atTime, ymd } from "../domain/time";
import { emptyState } from "../domain/types";
import type { AppState, Task } from "../domain/types";
import { parseSchedule } from "../iium/parser";

/** Three weeks of history: ~1 in 5 classes missed, the last two left unanswered, three tasks. */
export function seedState(now: Date): AppState {
  const today = ymd(now);
  let s = applySync({ ...emptyState(), onboarded: true }, parseSchedule(html), addDays(today, -21));
  const past = generateSessions(s, now).filter((x) => x.status === "unmarked");
  past.slice(0, -2).forEach((x, i) => {
    s = markSession(s, x.id, i % 5 === 3 ? "missed" : "attended");
  });
  const task = (title: string, courseId: string, days: number, done: boolean): Task => ({
    id: crypto.randomUUID(),
    title,
    courseId,
    due: atTime(addDays(today, days), "23:59").toISOString(),
    note: "",
    done,
  });
  const [a, b] = s.courses;
  return { ...s, tasks: [task("Lab report 2", a.id, -1, false), task("UX case study", b.id, 1, false), task("Quiz 1 prep", a.id, -5, true)] };
}
