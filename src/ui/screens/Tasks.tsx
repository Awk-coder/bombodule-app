import { useState } from "preact/hooks";
import { finishExams, unfinishExams } from "../../domain/actions";
import { addDays, ymd } from "../../domain/time";
import type { Task } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { useNow } from "../useNow";
import { IconPlus } from "../components/icons";
import { TaskRow } from "../components/TaskRow";
import { TaskSheet } from "../components/TaskSheet";

export function Tasks() {
  const state = useAppState();
  const now = useNow();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const upcoming = state.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const past = state.tasks.filter((t) => t.done).sort((a, b) => b.due.localeCompare(a.due));
  const edit = (t: Task | null) => {
    setEditing(t);
    setOpen(true);
  };
  const sem = state.semester;
  const today = ymd(now);
  const examWindow = !!sem && today > sem.end && today <= addDays(sem.end, 35);
  const examsOn = examWindow && !state.examsDone.includes(sem.label);
  const examsDone = examWindow && state.examsDone.includes(sem.label);
  const row = (t: Task) => (
    <TaskRow key={t.id} task={t} course={t.courseId ? courses.get(t.courseId) : undefined} now={now} onOpen={() => edit(t)} />
  );

  return (
    <>
      <h1 class="page-title">Tasks</h1>
      {examsOn && (
        <button class="card exams-card" onClick={() => dispatch((s) => finishExams(s, sem!.label))}>
          <b>Finished my last paper</b>
          <small>Tap after your final exam</small>
        </button>
      )}
      {examsDone && (
        <button class="card exams-card done" onClick={() => dispatch((s) => unfinishExams(s, sem!.label))}>
          <b>Exams done</b>
          <small>Tapped by mistake? Undo</small>
        </button>
      )}
      <h2 class="section-title">Upcoming <span class="count">{upcoming.length}</span></h2>
      {upcoming.length ? upcoming.map(row) : <button class="card muted add-card" onClick={() => edit(null)}>Nothing due. Tap to add a task.</button>}
      <h2 class="section-title muted">Past <span class="count">{past.length}</span></h2>
      {past.map(row)}
      <button class="fab" aria-label="Add task" onClick={() => edit(null)}><IconPlus size={28} /></button>
      <TaskSheet open={open} task={editing} onClose={() => setOpen(false)} />
    </>
  );
}
