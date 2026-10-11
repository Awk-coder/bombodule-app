import { useState } from "preact/hooks";
import { finishExams, unfinishExams } from "../../domain/actions";
import { isFinalExamTaskVisible } from "../../domain/calendar";
import { seasonElo } from "../../domain/elo";
import { ImportSlip } from "../components/ResultSlip";
import { addDays, ymd } from "../../domain/time";
import type { Task } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { useNow } from "../useNow";
import { IconPlus } from "../components/icons";
import { PixelIcon, LIGHTNING_ART } from "../components/pixelIcons";
import { TaskRow } from "../components/TaskRow";
import { TaskSheet } from "../components/TaskSheet";

export function Tasks() {
  const state = useAppState();
  const now = useNow();
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string | "all">("all");
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const finalsVisible = isFinalExamTaskVisible(state.semester, now);
  const upcoming = state.tasks
    .filter((t) => !t.done && (!t.final || finalsVisible))
    .sort((a, b) => a.due.localeCompare(b.due));
  const past = state.tasks.filter((t) => t.done).sort((a, b) => b.due.localeCompare(a.due));

  const courseIdsWithTasks = [...new Set(state.tasks.map((t) => t.courseId).filter((id): id is string => Boolean(id) && courses.has(id as string)))];
  const visibleUpcoming = filterCourse === "all" ? upcoming : upcoming.filter((t) => t.courseId === filterCourse);
  const visiblePast = filterCourse === "all" ? past : past.filter((t) => t.courseId === filterCourse);

  const edit = (t: Task | null) => {
    setEditing(t);
    setOpen(true);
  };
  const sem = state.semester;
  const today = ymd(now);
  const in7Days = addDays(today, 7);

  const dueToday = visibleUpcoming.filter((t) => t.due.slice(0, 10) <= today);
  const dueThisWeek = visibleUpcoming.filter((t) => t.due.slice(0, 10) > today && t.due.slice(0, 10) <= in7Days);
  const dueLater = visibleUpcoming.filter((t) => t.due.slice(0, 10) > in7Days);

  const examWindow = !!sem && today > sem.end && today <= addDays(sem.end, 35);
  const examsOn = examWindow && !state.examsDone.includes(sem.label);
  // Tapped "Finished my last paper" but that semester's slip isn't in yet: not ticked until it is.
  const examsPending = !!sem && state.examsDone.includes(sem.label) && !state.results.some((r) => r.label === sem.label);
  const season = seasonElo(state, now);
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
      {examsPending && (
        <div class="card exams-card pending">
          <b>Waiting for your {sem!.label} result slip</b>
          <small>Your exams count as finished once you import it.</small>
          <ImportSlip label="Import slip" />
          <button class="btn ghost" onClick={() => dispatch((s) => unfinishExams(s, sem!.label))}>Undo</button>
        </div>
      )}
      {season.rated && (
        <div class={`weekly-cap-indicator ${season.weeklyTaskCount >= 5 ? "capped" : ""}`} style={{ marginBottom: "16px" }}>
          <div class="weekly-cap-content">
            <PixelIcon art={LIGHTNING_ART} />
            <span>{season.weeklyTaskCount >= 5 ? "Weekly task cap reached" : "Weekly Ranked Tasks"}</span>
            <div class="weekly-cap-cells" aria-label={`${season.weeklyTaskCount}/5 tasks`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} class={`cap-cell ${i < season.weeklyTaskCount ? "active" : ""}`} />
              ))}
            </div>
            <span class="weekly-cap-fraction">{season.weeklyTaskCount}/5</span>
          </div>
        </div>
      )}

      {courseIdsWithTasks.length > 1 && (
        <div class="filter-chips-bar">
          <button class={`filter-chip ${filterCourse === "all" ? "active" : ""}`} onClick={() => setFilterCourse("all")}>
            All ({upcoming.length})
          </button>
          {courseIdsWithTasks.map((cid) => {
            const c = courses.get(cid)!;
            const count = upcoming.filter((t) => t.courseId === cid).length;
            return (
              <button key={cid} class={`filter-chip ${filterCourse === cid ? "active" : ""}`} onClick={() => setFilterCourse(cid)}>
                {c.code} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {!visibleUpcoming.length ? (
        <>
          <h2 class="section-title">Upcoming <span class="count">0</span></h2>
          <button class="card muted add-card" onClick={() => edit(null)}>Nothing due. Tap to add a task.</button>
        </>
      ) : (
        <>
          {dueToday.length > 0 && (
            <>
              <h2 class="section-title urgent">Due Today <span class="count">{dueToday.length}</span></h2>
              {dueToday.map(row)}
            </>
          )}
          {dueThisWeek.length > 0 && (
            <>
              <h2 class="section-title">This Week <span class="count">{dueThisWeek.length}</span></h2>
              {dueThisWeek.map(row)}
            </>
          )}
          {dueLater.length > 0 && (
            <>
              <h2 class="section-title muted">Later <span class="count">{dueLater.length}</span></h2>
              {dueLater.map(row)}
            </>
          )}
        </>
      )}

      {visiblePast.length > 0 && (
        <>
          <h2 class="section-title muted">Past <span class="count">{visiblePast.length}</span></h2>
          <div style={{ paddingBottom: "70px" }}>
            {visiblePast.map(row)}
          </div>
        </>
      )}
      <button class="fab" aria-label="Add task" onClick={() => edit(null)}><IconPlus size={28} /></button>
      <TaskSheet open={open} task={editing} onClose={() => setOpen(false)} />
    </>
  );
}
