import { useState } from "preact/hooks";
import { hhmm } from "../../domain/time";
import type { Session, SessionStatus } from "../../domain/types";
import { fmtDate, fmtTime } from "../format";

const LABEL: Record<SessionStatus, string> = { upcoming: "Upcoming", unmarked: "Not answered", attended: "Attended", missed: "Missed" };

export function SessionGrid({ sessions }: { sessions: Session[] }) {
  const [selected, setSelected] = useState<Session | null>(null);
  return (
    <div class="grid-card">
      <div class="sgrid">
        {sessions.map((s) => (
          <button key={s.id} class={`sq sq-${s.status}`} aria-label={`${fmtDate(s.date)} ${LABEL[s.status]}`} onClick={() => setSelected(s)} />
        ))}
      </div>
      <p class="grid-caption">
        {selected
          ? `${fmtDate(selected.date)} · ${fmtTime(hhmm(selected.start))} · ${LABEL[selected.status]}`
          : `${sessions.length} classes this semester`}
      </p>
    </div>
  );
}
