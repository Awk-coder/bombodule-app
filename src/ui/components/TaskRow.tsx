import { toggleTask } from "../../domain/actions";
import { ymd } from "../../domain/time";
import type { Course, Task } from "../../domain/types";
import { dispatch } from "../../store/store";
import { fmtDate, relDue } from "../format";
import { IconCheck } from "./icons";

export function TaskRow({ task, course, now, onOpen }: { task: Task; course?: Course; now: Date; onOpen: () => void }) {
  const due = new Date(task.due);
  const overdue = !task.done && due < now;

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
        <b>{task.final && <span class="final-tag">FINAL</span>}{task.title}</b>
        <small>{[course?.code, task.done ? fmtDate(ymd(due)) : relDue(due, now)].filter(Boolean).join(" · ")}</small>
      </div>
      {!task.done && (
        <span class={`task-reward-pill ${task.final ? "final" : ""}`}>
          {task.final ? "+18 Elo" : "+3 Elo"}
        </span>
      )}
    </div>
  );
}
