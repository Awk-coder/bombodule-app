import { useEffect, useState } from "preact/hooks";
import { completeTour } from "../../domain/actions";
import { dispatch, useAppState } from "../../store/store";
import { go } from "../router";
import { PixelIcon, BOOK_ART, LIGHTNING_ART, SHIELD_ART, SWORD_ART } from "./pixelIcons";
import { Sheet } from "./Sheet";

export const TOUR_STORAGE_KEY = "uni-ranked-tour-completed";

interface TourStep {
  tag: string;
  title: string;
  desc: string;
  tab: "home" | "schedule" | "tasks" | "ranked";
  art: typeof SHIELD_ART;
  bullet: string;
}

const STEPS: TourStep[] = [
  {
    tag: "STEP 1 · HOME",
    title: "Daily Attendance & Barring Shield",
    desc: "Your daily hub. Swipe right when you attend class, or left if you missed. Uni Ranked keeps track of your absences so you stay safely above the 80% barring threshold.",
    tab: "home",
    art: SHIELD_ART,
    bullet: "Absence warnings trigger before you hit the limit",
  },
  {
    tag: "STEP 2 · SCHEDULE",
    title: "Weekly Timetable & Venues",
    desc: "Your entire semester timetable mapped out. See venues, section codes, and lecture times. Use 'Mark All Attended' on busy days to catch up in one tap.",
    tab: "schedule",
    art: BOOK_ART,
    bullet: "Switch between day and week views seamlessly",
  },
  {
    tag: "STEP 3 · TASKS",
    title: "Coursework & Season Elo",
    desc: "Add your assignments, quizzes, labs, and project deadlines. Completing verified academic coursework earns you season Elo up to your weekly cap.",
    tab: "tasks",
    art: LIGHTNING_ART,
    bullet: "Earn up to +18 Elo on final papers and projects",
  },
  {
    tag: "STEP 4 · RANKED",
    title: "Leaderboard & Divisions",
    desc: "Climb through 6 Elo divisions: Coal, Iron, Gold, Emerald, Diamond, and Netherite. Create a squad to race your friends or see where you rank across campus.",
    tab: "ranked",
    art: SWORD_ART,
    bullet: "Equip unlocked titles and show off your grade tier",
  },
];

let globalOpenTour: (() => void) | null = null;
export const triggerAppTour = () => {
  if (globalOpenTour) globalOpenTour();
};

export function OnboardingTour() {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    globalOpenTour = () => {
      setIdx(0);
      setOpen(true);
      go("#/home");
    };
    return () => {
      globalOpenTour = null;
    };
  }, []);

  useEffect(() => {
    // Only trigger if onboarded and tour has never been completed
    if (state.onboarded && !state.tourCompleted) {
      try {
        const seen = localStorage.getItem(TOUR_STORAGE_KEY);
        if (seen !== "true") {
          // Small delay so the app mounts cleanly first
          const t = setTimeout(() => {
            setIdx(0);
            setOpen(true);
          }, 400);
          return () => clearTimeout(t);
        }
      } catch {}
    }
  }, [state.onboarded, state.tourCompleted]);

  const closeTour = () => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {}
    dispatch(completeTour);
    go("#/home");
  };

  const nextStep = () => {
    if (idx < STEPS.length - 1) {
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      go(`#/${STEPS[nextIdx].tab}`);
    } else {
      closeTour();
    }
  };

  const current = STEPS[idx];

  return (
    <Sheet open={open} onClose={closeTour} className="tour-sheet">
      <div class="tour-container">
        <div class="tour-top-bar">
          <span class="tour-tag">{current.tag}</span>
          <button class="tour-skip-btn" onClick={closeTour}>Skip tour</button>
        </div>

        <div class="tour-progress-pills">
          {STEPS.map((_, i) => (
            <span key={i} class={`tour-pill ${i === idx ? "active" : i < idx ? "passed" : ""}`} />
          ))}
        </div>

        <div class="tour-body">
          <div class="tour-icon-wrap">
            <PixelIcon art={current.art} scale={2} />
          </div>
          <h2 class="tour-title">{current.title}</h2>
          <p class="tour-desc">{current.desc}</p>
          <div class="tour-bullet-card">
            <span class="tour-bullet-dot" />
            <small>{current.bullet}</small>
          </div>
        </div>

        <div class="tour-actions">
          <button class="btn primary" onClick={nextStep}>
            {idx === STEPS.length - 1 ? "Start using Uni Ranked" : "Next"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
