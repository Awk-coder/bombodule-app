import { toggleTask } from "../../domain/actions";
import { ymd } from "../../domain/time";
import type { Course, Task } from "../../domain/types";
import { dispatch } from "../../store/store";
import { fmtDate, relDue } from "../format";
import { IconCheck } from "./icons";

function getTaskCategory(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("quiz")) return "Quiz";
  if (t.includes("exam") || t.includes("paper") || t.includes("midterm") || t.includes("test")) return "Exam";
  if (t.includes("proj")) return "Project";
  if (t.includes("presen")) return "Presentation";
  if (t.includes("lab")) return "Lab";
  if (t.includes("assign") || t.includes("report") || t.includes("homework")) return "Assignment";
  return null;
}

export function TaskRow({ task, course, now, onOpen }: { task: Task; course?: Course; now: Date; onOpen: () => void }) {
  const due = new Date(task.due);
  const overdue = !task.done && due < now;
  const category = getTaskCategory(task.title);

  return (
    <div class={`row ${task.done ? "task-done" : ""} ${overdue ? "overdue" : ""} ${task.final ? "task-final" : ""}`} onClick={onOpen}>
      <button
        class={`check ${task.done ? "on" : ""}`}
        aria-label={task.done ? "Mark not done" : "Mark done"}
        onClick={(e) => {
          e.stopPropagation();
          dispatch((s) => toggleTask(s, task.id));
        }}
      >
        {task.done && <IconCheck size={14} />}
      </button>
      <div class="grow">
        <div class="task-title-line">
          {task.final && <span class="final-tag">FINAL</span>}
          {category && !task.final && <span class="task-cat-tag">{category}</span>}
          <b>{task.title}</b>
        </div>
        <small>{[course?.code, task.done ? fmtDate(ymd(due)) : relDue(due, now)].filter(Boolean).join(" · ")}</small>
      </div>
      <div class="task-reward-slot">
        {task.done ? (
          <span class="task-reward-pill done">Done</span>
        ) : task.final ? (
          <span class="task-reward-pill final">+35 Elo</span>
        ) : (
          <span class="task-reward-pill">+6 Elo</span>
        )}
      </div>
    </div>
  );
}
