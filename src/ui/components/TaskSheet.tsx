import { useEffect, useState } from "preact/hooks";
import { deleteTask, upsertTask } from "../../domain/actions";
import { addDays, atTime, hhmm, ymd } from "../../domain/time";
import type { Task } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { Chips } from "./Chips";
import { Sheet } from "./Sheet";
import { Toggle } from "./Toggle";

interface Props {
  open: boolean;
  task: Task | null;
  presetCourseId?: string | null;
  onClose: () => void;
}

export function TaskSheet({ open, task, presetCourseId = null, onClose }: Props) {
  const state = useAppState();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [note, setNote] = useState("");
  const [final, setFinal] = useState(false);

  useEffect(() => {
    if (!open) return;
    const due = task ? new Date(task.due) : null;
    setTitle(task?.title ?? "");
    setCourseId(task ? task.courseId : presetCourseId);
    setDate(due ? ymd(due) : addDays(ymd(new Date()), 1));
    setTime(due ? hhmm(due) : "23:59");
    setNote(task?.note ?? "");
    setFinal(task?.final ?? false);
  }, [open, task, presetCourseId]);

  function save() {
    const next: Task = {
      id: task?.id ?? crypto.randomUUID(),
      title: title.trim(),
      courseId,
      due: atTime(date, time).toISOString(),
      note: note.trim(),
      done: task?.done ?? false,
      ...(task?.completedAt && { completedAt: task.completedAt }),
      ...(final && { final: true }),
    };
    dispatch((s) => upsertTask(s, next));
    onClose();
  }

  function remove() {
    if (task) dispatch((s) => deleteTask(s, task.id));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2>{task ? "Edit task" : "New task"}</h2>
      <label class="field"><span>Title</span><input value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Lab report 2" /></label>
      <div class="field">
        <span>Course</span>
        <Chips
          options={[{ value: null, label: "No course" }, ...state.courses.filter((c) => c.active).map((c) => ({ value: c.id as string | null, label: c.code }))]}
          value={courseId}
          onChange={setCourseId}
        />
      </div>
      <div class="field-row">
        <label class="field"><span>Due date</span><input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} /></label>
        <label class="field"><span>Time</span><input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></label>
      </div>
      <div class="row final-row">
        <div class="grow"><b>Final assignment</b><small>Worth more on your Ranked season</small></div>
        <Toggle on={final} onChange={setFinal} />
      </div>
      <label class="field"><span>Note</span><textarea rows={3} value={note} onInput={(e) => setNote(e.currentTarget.value)} /></label>
      <button class="btn primary" disabled={!title.trim() || !date || !time} onClick={save}>Save</button>
      {task && <button class="btn ghost" onClick={remove}>Delete task</button>}
    </Sheet>
  );
}
