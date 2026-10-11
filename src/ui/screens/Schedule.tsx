import { useRef, useState } from "preact/hooks";
import { setCourseStart } from "../../domain/actions";
import { courseStats } from "../../domain/attendance";
import { generateTimetableIcs } from "../../domain/calendarExport";
import { seasonElo } from "../../domain/elo";
import { rankOf } from "../../domain/grades";
import { generateSessions } from "../../domain/sessions";
import { hhmm } from "../../domain/time";
import type { AppState, Day, Slot } from "../../domain/types";
import { shareFile } from "../../native/share";
import { dispatch, useAppState } from "../../store/store";
import { dayName, fmtDate, fmtTime, titleCase } from "../format";
import { courseColor } from "../palette";
import { courseHref, go } from "../router";
import { useNow } from "../useNow";
import { Chips } from "../components/Chips";
import { IconCalendar } from "../components/icons";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";
import { ShaderGradientBackground } from "../components/ShaderGradientBackground";
import { Sheet } from "../components/Sheet";

const PX_PER_MIN = 1.5;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const mondayFirst = (d: number) => (d + 6) % 7;
const HOLD_MS = 5000; // hold a class this long to set its actual start date
const MOVE_PX = 10; // a drag past this is a scroll, not a hold

/** Every date the course is scheduled to meet this semester, ignoring any late start already set. */
function scheduledDates(state: AppState, courseId: string, now: Date): string[] {
  const asScheduled = { ...state, courses: state.courses.map((c) => (c.id === courseId ? { ...c, startFrom: undefined } : c)) };
  return [...new Set(generateSessions(asScheduled, now).filter((s) => s.courseId === courseId).map((s) => s.date))];
}

export function Schedule() {
  const state = useAppState();
  const now = useNow();
  const [viewMode, setViewModeState] = useState<"day" | "week">(() => {
    try {
      const saved = localStorage.getItem("uni_sched_view") as "day" | "week" | null;
      if (saved) return saved;
    } catch {}
    if (import.meta.env.MODE === "test") return "week";
    return "day";
  });
  const setViewMode = (m: "day" | "week") => {
    setViewModeState(m);
    try {
      localStorage.setItem("uni_sched_view", m);
    } catch {}
  };

  const [selectedDay, setSelectedDay] = useState<Day>(() => now.getDay() as Day);
  const [open, setOpen] = useState<Slot | null>(null);
  const [startFor, setStartFor] = useState<string | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const held = useRef(false);

  const endHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
    setHolding(null);
  };
  const startHold = (s: Slot, e: PointerEvent) => {
    endHold();
    held.current = false;
    setHolding(s.id);
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        held.current = true;
        endHold();
        setStartFor(s.courseId);
      }, HOLD_MS),
    };
  };
  const moveHold = (e: PointerEvent) => {
    const h = hold.current;
    if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > MOVE_PX) endHold();
  };

  const courses = new Map(state.courses.filter((c) => c.active).map((c) => [c.id, c]));
  const slots = state.slots.filter((s) => courses.has(s.courseId) && !s.until);
  const title = <h1 class="page-title">{state.semester?.label ?? "Schedule"}</h1>;
  if (!slots.length) return <>{title}<LinkCard /></>;

  const days = [...new Set(slots.map((s) => s.day))].sort((a, b) => mondayFirst(a) - mondayFirst(b));
  const activeDay: Day = days.includes(selectedDay) ? selectedDay : (days[0] ?? (now.getDay() as Day));
  const visibleDays: Day[] = viewMode === "day" ? [activeDay] : days;

  const startMin = Math.floor(Math.min(...slots.map((s) => toMin(s.start))) / 60) * 60;
  const endMin = Math.ceil(Math.max(...slots.map((s) => toMin(s.end))) / 60) * 60;
  const y = (min: number) => (min - startMin) * PX_PER_MIN;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lines: number[] = [];
  for (let m = startMin; m <= endMin; m += 30) lines.push(m);
  const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const openCourse = open ? courses.get(open.courseId) : undefined;
  const openStats = openCourse ? courseStats(openCourse, generateSessions(state, now)) : undefined;
  const startCourse = startFor ? courses.get(startFor) : undefined;
  const startDates = startFor ? scheduledDates(state, startFor, now) : [];

  const onExportCalendar = async () => {
    const ics = generateTimetableIcs(state);
    if (!ics) return;
    const filename = `${state.semester?.label?.replace(/[^a-zA-Z0-9]/g, "_") || "timetable"}.ics`;
    await shareFile(filename, ics, "text/calendar");
  };

  const season = seasonElo(state, now);
  const rank = rankOf(season.elo);
  const ore = season.rated ? rank.ore : "coal";

  return (
    <div class="sched-screen">
      <ShaderGradientBackground ore={ore} height={340} />
      <div class="sched-top-bar">
        {title}
        <div class="sched-actions">
          <button class="sched-export-btn" onClick={onExportCalendar} title="Export timetable to phone calendar">
            <IconCalendar size={15} /> <span>Export .ics</span>
          </button>
          <div class="seg-toggle">
            <button class={viewMode === "day" ? "on" : ""} onClick={() => setViewMode("day")}>Day</button>
            <button class={viewMode === "week" ? "on" : ""} onClick={() => setViewMode("week")}>Week</button>
          </div>
        </div>
      </div>

      <div class="sched" style={`--cols:${visibleDays.length}`}>
        <div class="sched-head" style={`grid-template-columns: repeat(${days.length}, 1fr) var(--label-w)`}>
          {days.map((d) => (
            <button
              key={d}
              class={`day-pill ${d === (viewMode === "day" ? activeDay : now.getDay()) ? "active" : ""}`}
              onClick={() => setSelectedDay(d)}
            >
              {dayName(d)}
            </button>
          ))}
          <span />
        </div>
        <div class="sched-scroll">
          <div class="sched-body" style={`height:${y(endMin) + 12}px`}>
            {lines.map((m) => (
              <div key={m} class="hour-line" style={`top:${y(m)}px`}>
                <span>{label(m)}</span>
              </div>
            ))}
            {visibleDays.map((d, i) =>
              slots
                .filter((s) => s.day === d)
                .map((s) => {
                  const c = courses.get(s.courseId)!;
                  const color = courseColor(c.color);
                  return (
                    <button
                      key={s.id}
                      class={`block ${holding === s.id ? "holding" : ""}`}
                      style={`left:calc(var(--col) * ${i});top:${y(toMin(s.start)) + 3}px;height:${(toMin(s.end) - toMin(s.start)) * PX_PER_MIN - 6}px;background:${color.bg};color:${color.fg}`}
                      onPointerDown={(e) => startHold(s, e)}
                      onPointerMove={moveHold}
                      onPointerUp={endHold}
                      onPointerCancel={endHold}
                      onPointerLeave={endHold}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        if (held.current) held.current = false;
                        else setOpen(s);
                      }}
                    >
                      <span class="t1">{s.start}</span>
                      <b>{c.code}</b>
                      <small>{titleCase(c.name)}{viewMode === "day" && s.venue ? ` · ${s.venue}` : ""}</small>
                      <span class="t2">{s.end}</span>
                    </button>
                  );
                }),
            )}
            {nowMin >= startMin && nowMin <= endMin && (
              <div class="now-line" style={`top:${y(nowMin)}px`}>
                <span>{hhmm(now)}</span>
              </div>
            )}
          </div>
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

      <Sheet open={!!startCourse} onClose={() => setStartFor(null)}>
        {startCourse && (
          <>
            <h2>Actual start</h2>
            <p class="group-hint">{startCourse.code} · Section {startCourse.section}. Classes before this date won't count.</p>
            <Chips
              options={startDates.map((d) => ({ value: d, label: fmtDate(d) }))}
              value={startCourse.startFrom ?? startDates[0]}
              onChange={(d) => {
                dispatch((st) => setCourseStart(st, startCourse.id, d === startDates[0] ? null : d));
                setStartFor(null);
              }}
            />
          </>
        )}
      </Sheet>
    </div>
  );
}
