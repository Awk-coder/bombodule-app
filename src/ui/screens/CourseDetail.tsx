import { useMemo, useState } from "preact/hooks";
import { markSession } from "../../domain/actions";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { hhmm } from "../../domain/time";
import type { Task } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { fmtDate, fmtTime, titleCase } from "../format";
import { useNow } from "../useNow";
import { IconBack } from "../components/icons";
import { SessionGrid } from "../components/SessionGrid";
import { TaskRow } from "../components/TaskRow";
import { TaskSheet } from "../components/TaskSheet";

export function CourseDetail({ id }: { id: string }) {
  const state = useAppState();
  const now = useNow();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const course = state.courses.find((c) => c.id === id);
  const sessions = useMemo(() => generateSessions(state, now).filter((s) => s.courseId === id), [state, now, id]);
  const back = <a class="back" href="#/courses"><IconBack size={18} /> Courses</a>;
  if (!course) return <>{back}<div class="card muted">Course not found.</div></>;

  const st = courseStats(course, sessions);
  const history = sessions.filter((s) => s.status !== "upcoming").reverse();
  const tasks = state.tasks.filter((t) => t.courseId === id).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const barred = st.risk === "barred";
  const edit = (t: Task | null) => {
    setEditing(t);
    setOpen(true);
  };

  return (
    <>
      {back}
      <span class="chip">{course.code}</span>
      <h1 class="detail-title">{titleCase(course.name)}</h1>

      <div class="stats">
        <div class={`stat risk-${st.risk}`}><b>{barred ? "!" : st.canStillMiss}</b><span>{barred ? "Barred" : "can still miss"}</span></div>
        <div class="stat"><b>{st.currentStreak}</b><span>current streak</span></div>
        <div class="stat"><b>{st.bestStreak}</b><span>best streak</span></div>
      </div>

      <SessionGrid sessions={sessions} />

      <h2 class="section-title">History</h2>
      {history.length === 0 && <div class="card muted">No classes yet.</div>}
      {history.map((s) => (
        <div class="row" key={s.id}>
          <div class="grow"><b>{fmtDate(s.date)}</b><small>{fmtTime(hhmm(s.start))}{s.assumed ? " · not answered" : ""}</small></div>
          <div class="seg">
            <button class={s.status === "attended" ? "on ok" : ""} onClick={() => dispatch((x) => markSession(x, s.id, "attended"))}>Attended</button>
            <button class={s.status === "missed" ? "on bad" : ""} onClick={() => dispatch((x) => markSession(x, s.id, "missed"))}>Missed</button>
          </div>
        </div>
      ))}

      <h2 class="section-title">Tasks <button class="link" onClick={() => edit(null)}>+ Add</button></h2>
      {tasks.length === 0 && <div class="card muted">No tasks for this course.</div>}
      {tasks.map((t) => <TaskRow key={t.id} task={t} course={course} now={now} onOpen={() => edit(t)} />)}
      <TaskSheet open={open} task={editing} presetCourseId={id} onClose={() => setOpen(false)} />
    </>
  );
}
