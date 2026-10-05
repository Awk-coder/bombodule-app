import { useState } from "preact/hooks";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { hhmm } from "../../domain/time";
import type { Slot } from "../../domain/types";
import { useAppState } from "../../store/store";
import { dayName, fmtTime, titleCase } from "../format";
import { courseColor } from "../palette";
import { courseHref, go } from "../router";
import { useNow } from "../useNow";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";
import { Sheet } from "../components/Sheet";

const PX_PER_MIN = 1.5;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const mondayFirst = (d: number) => (d + 6) % 7;

export function Schedule() {
  const state = useAppState();
  const now = useNow();
  const [open, setOpen] = useState<Slot | null>(null);

  const courses = new Map(state.courses.filter((c) => c.active).map((c) => [c.id, c]));
  const slots = state.slots.filter((s) => courses.has(s.courseId) && !s.until);
  const title = <h1 class="page-title">{state.semester?.label ?? "Schedule"}</h1>;
  if (!slots.length) return <>{title}<LinkCard /></>;

  const days = [...new Set(slots.map((s) => s.day))].sort((a, b) => mondayFirst(a) - mondayFirst(b));
  const startMin = Math.floor(Math.min(...slots.map((s) => toMin(s.start))) / 60) * 60;
  const endMin = Math.ceil(Math.max(...slots.map((s) => toMin(s.end))) / 60) * 60;
  const y = (min: number) => (min - startMin) * PX_PER_MIN;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lines: number[] = [];
  for (let m = startMin; m <= endMin; m += 30) lines.push(m);
  const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const openCourse = open ? courses.get(open.courseId) : undefined;
  const openStats = openCourse ? courseStats(openCourse, generateSessions(state, now)) : undefined;

  return (
    <>
      {title}
      <div class="sched" style={`--cols:${days.length}`}>
        <div class="sched-head">
          {days.map((d) => <span key={d} class={`day-pill ${d === now.getDay() ? "active" : ""}`}>{dayName(d)}</span>)}
          <span />
        </div>
        <div class="sched-body" style={`height:${y(endMin) + 12}px`}>
          {lines.map((m) => <div key={m} class="hour-line" style={`top:${y(m)}px`}><span>{label(m)}</span></div>)}
          {days.map((d, i) =>
            slots.filter((s) => s.day === d).map((s) => {
              const c = courses.get(s.courseId)!;
              const color = courseColor(c.color);
              return (
                <button
                  key={s.id}
                  class="block"
                  style={`left:calc(var(--col) * ${i});top:${y(toMin(s.start)) + 3}px;height:${(toMin(s.end) - toMin(s.start)) * PX_PER_MIN - 6}px;background:${color.bg};color:${color.fg}`}
                  onClick={() => setOpen(s)}
                >
                  <span class="t1">{s.start}</span>
                  <b>{c.code}</b>
                  <small>{titleCase(c.name)}</small>
                  <span class="t2">{s.end}</span>
                </button>
              );
            }),
          )}
          {nowMin >= startMin && nowMin <= endMin && (
            <div class="now-line" style={`top:${y(nowMin)}px`}><span>{hhmm(now)}</span></div>
          )}
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && openCourse && openStats && (
          <>
            <h2>{titleCase(openCourse.name)}</h2>
            <p class="group-hint">{openCourse.code} · Section {openCourse.section}</p>
            <div class="row"><div class="grow"><b>{dayName(open.day)} {fmtTime(open.start)} – {fmtTime(open.end)}</b><small>{open.venue}</small></div></div>
            <div class="row"><div class="grow"><b>Lecturer</b><small>{open.lecturer || "—"}</small></div></div>
            <div class="card">
              <div class="course-head"><span>Absences</span><span class={`risk-text-${openStats.risk}`}>{riskLabel(openStats.missed, openStats.limit)}</span></div>
              <Meter missed={openStats.missed} limit={openStats.limit} />
            </div>
            <button class="btn primary" onClick={() => { setOpen(null); go(courseHref(openCourse.id)); }}>Open course</button>
          </>
        )}
      </Sheet>
    </>
  );
}
