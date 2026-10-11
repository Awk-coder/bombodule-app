import { toggleTask } from "../../domain/actions";
import { ymd } from "../../domain/time";
import type { Course, Task } from "../../domain/types";
import { dispatch } from "../../store/store";
import { fmtDate, relDue } from "../format";
import { IconCheck } from "./icons";
import { PixelIcon, SWORD_ART, BUM_ART } from "./pixelIcons";

export function TaskRow({ task, course, now, onOpen }: { task: Task; course?: Course; now: Date; onOpen: () => void }) {
  const due = new Date(task.due);
  const overdue = !task.done && due < now;

  return (
    <div class={`row ${task.done ? "task-done" : ""} ${overdue ? "overdue" : ""} ${task.final ? "task-final" : ""} ${task.bullshit ? "task-bum" : ""}`} onClick={onOpen}>
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
        <b>
          {task.bullshit && <span class="task-pixel-icon" title="Non-academic task"><PixelIcon art={BUM_ART} size={11} /></span>}
          {task.final && !task.bullshit && <span class="task-pixel-icon" title="Final assignment"><PixelIcon art={SWORD_ART} size={11} /></span>}
          {task.final && <span class="final-tag">FINAL</span>}
          {task.title}
        </b>
        <small>{[course?.code, task.done ? fmtDate(ymd(due)) : relDue(due, now)].filter(Boolean).join(" · ")}</small>
      </div>
      {!task.done && (
        <span class={`task-reward-pill ${task.bullshit ? "unranked" : task.final ? "final" : ""}`}>
          {task.bullshit ? "0 Elo" : task.final ? "+18 Elo" : "+3 Elo"}
        </span>
      )}
    </div>
  );
}
