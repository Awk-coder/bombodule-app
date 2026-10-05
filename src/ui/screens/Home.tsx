import { useMemo } from "preact/hooks";
import { markSession } from "../../domain/actions";
import { courseStats, daySummary } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { hhmm, ymd } from "../../domain/time";
import type { Course, Session, Slot } from "../../domain/types";
import { dispatch, useAppState } from "../../store/store";
import { dayName, fmtDate, fmtTime, greeting, minutesLeft, relDue, shortName, titleCase } from "../format";
import { courseHref, go } from "../router";
import { useNow } from "../useNow";
import { IconCheck, IconClock, IconPin } from "../components/icons";
import { SwipeRow } from "../components/SwipeRow";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";
import { TaskRow } from "../components/TaskRow";

type Info = (s: Session) => { course: Course; slot: Slot };

function NowCard({ current, upcoming, info, now }: { current?: Session; upcoming: Session[]; info: Info; now: Date }) {
  const main = current ?? upcoming[0];
  if (!main) return <div class="card muted">No more classes this semester</div>;
  const { course, slot } = info(main);
  const pct = current ? Math.min(100, ((now.getTime() - main.start.getTime()) / (main.end.getTime() - main.start.getTime())) * 100) : 0;
  const after = current ? upcoming[0] : upcoming[1];
  const n = after && info(after);
  return (
    <div class="hero">
      <div class="hero-class">
        <div class="hero-top">
          <span class="chip">{course.code}</span>
          {current && <div class="progress"><span style={`width:${pct}%`} /></div>}
          <span class="hero-left">{current ? `${minutesLeft(main.end, now)} min left` : `starts ${relDue(main.start, now)}`}</span>
        </div>
        <p class="hero-time"><IconClock size={14} /> {fmtTime(slot.start)} - {fmtTime(slot.end)} · {dayName(main.start.getDay())}</p>
        <p class="hero-name">{titleCase(course.name)}</p>
        <p class="hero-venue"><IconPin size={14} /> {slot.venue}</p>
      </div>
      {after && n && (
        <>
          <span class="pill danger">UPCOMING</span>
          <div class="next-row">
            <div><b>{n.course.code}</b><small>{titleCase(n.course.name)}</small></div>
            <div class="right"><small>{dayName(after.start.getDay())}</small><b>{fmtTime(n.slot.start)} - {fmtTime(n.slot.end)}</b><small>{n.slot.venue}</small></div>
          </div>
        </>
      )}
    </div>
  );
}

function CaughtUp({ sessions, today }: { sessions: Session[]; today: string }) {
  const d = daySummary(sessions, today);
  const attended = sessions.filter((s) => s.status === "attended").length;
  const missed = sessions.filter((s) => s.status === "missed").length;
  const todayLine = d.total
    ? [`Today: ${d.attended}/${d.total} attended`, d.missed && `${d.missed} missed`, d.left && `${d.left} to go`].filter(Boolean).join(" · ")
    : "No classes today";
  return (
    <div class="card caught-up">
      <span class="caught-up-icon"><IconCheck size={20} /></span>
      <div>
        <b>All classes marked</b>
        <small>{todayLine}</small>
        <small>This semester: {attended} attended · {missed} missed</small>
      </div>
    </div>
  );
}

export function Home() {
  const state = useAppState();
  const now = useNow();
  const sessions = useMemo(() => generateSessions(state, now), [state, now]);
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const slots = new Map(state.slots.map((s) => [s.id, s]));
  const info: Info = (s) => ({ course: courses.get(s.courseId)!, slot: slots.get(s.slotId)! });

  const current = sessions.find((s) => s.start <= now && now < s.end);
  const upcoming = sessions.filter((s) => s.start > now).slice(0, 2);
  const unmarked = sessions.filter((s) => s.status === "unmarked").reverse();
  const warnings = state.courses
    .filter((c) => c.active)
    .map((c) => ({ c, st: courseStats(c, sessions) }))
    .filter((x) => x.st.risk !== "ok")
    .sort((a, b) => b.st.missed - a.st.missed);
  const due = state.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);

  return (
    <>
      <header class="greeting">
        <p>{greeting(now)}</p>
        <h1>{state.account?.name ? shortName(state.account.name) : "Student"}</h1>
      </header>

      {state.courses.length === 0 ? <LinkCard /> : <NowCard current={current} upcoming={upcoming} info={info} now={now} />}

      <div class="home-scroll">
      {unmarked.length === 0 && state.courses.length > 0 && <CaughtUp sessions={sessions} today={ymd(now)} />}

      {unmarked.length > 0 && (
        <>
          <h2 class="section-title">Unmarked <span class="count">{unmarked.length}</span></h2>
          <p class="group-hint">Swipe right if you attended, left if you missed.</p>
          {unmarked.map((s) => (
            <SwipeRow
              key={s.id}
              onRight={() => dispatch((st) => markSession(st, s.id, "attended"))}
              onLeft={() => dispatch((st) => markSession(st, s.id, "missed"))}
            >
              <div class="grow"><b>{info(s).course.code}</b><small>{fmtDate(s.date)} · {fmtTime(hhmm(s.start))}</small></div>
              <span class="swipe-arrows">‹ ›</span>
            </SwipeRow>
          ))}
        </>
      )}

      {warnings.length > 0 && (
        <>
          <h2 class="section-title">Watch out</h2>
          {warnings.map(({ c, st }) => (
            <a key={c.id} class={`card glow-${st.risk === "warn" ? "warn" : "danger"}`} href={courseHref(c.id)}>
              <div class="course-head"><span class="chip">{c.code}</span><span class={`risk-text-${st.risk}`}>{riskLabel(st.missed, st.limit)}</span></div>
              <Meter missed={st.missed} limit={st.limit} />
            </a>
          ))}
        </>
      )}

      {due.length > 0 && (
        <>
          <h2 class="section-title">Due soon</h2>
          {due.map((t) => (
            <TaskRow key={t.id} task={t} course={t.courseId ? courses.get(t.courseId) : undefined} now={now} onOpen={() => go("#/tasks")} />
          ))}
        </>
      )}
      </div>
    </>
  );
}
