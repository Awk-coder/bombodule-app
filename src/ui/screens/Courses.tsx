import { useMemo } from "preact/hooks";
import { courseStats } from "../../domain/attendance";
import { generateSessions } from "../../domain/sessions";
import { useAppState } from "../../store/store";
import { titleCase } from "../format";
import { courseHref } from "../router";
import { useNow } from "../useNow";
import { LinkCard } from "../components/LinkCard";
import { Meter, riskLabel } from "../components/Meter";

export function Courses() {
  const state = useAppState();
  const now = useNow();
  const sessions = useMemo(() => generateSessions(state, now), [state, now]);
  const list = state.courses
    .filter((c) => c.active)
    .map((c) => ({ c, st: courseStats(c, sessions) }))
    .sort((a, b) => b.st.missed - a.st.missed || a.c.code.localeCompare(b.c.code));

  return (
    <>
      <h1 class="page-title">Courses</h1>
      {list.length === 0 && <LinkCard />}
      {list.map(({ c, st }) => (
        <a key={c.id} class="card" href={courseHref(c.id)}>
          <div class="course-head"><span class="chip">{c.code}</span><span class={`risk-text-${st.risk}`}>{riskLabel(st.missed, st.limit)}</span></div>
          <p class="course-name">{titleCase(c.name)}</p>
          <Meter missed={st.missed} limit={st.limit} />
        </a>
      ))}
    </>
  );
}
