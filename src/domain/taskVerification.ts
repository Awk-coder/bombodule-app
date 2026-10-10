export interface TaskVerificationResult {
  academic: boolean;
  bullshit?: boolean;
  reason?: string;
}

// Academic indicators that denote legitimate coursework even if titles contain words like "game" or "clean"
const ACADEMIC_KEYWORDS =
  /\b(assignment|quiz|lab|report|exam|midterm|final|project|essay|tutorial|homework|hw|problem set|paper|presentation|slides|thesis|proposal|review|exercise|analysis|study|revision|draft|submission|submit|milestone|reading|case study|code review|implementation|experiment|syllabus|chapter|lecture)\b/i;

// Non-academic activity patterns
const CHORES =
  /\b(clean|cleaning|wash|washing|laundry|sweep|sweeping|mop|mopping|tidy|tidying|dishes|trash|garbage|groceries|grocery|vacuum|vacuuming|fold clothes)\b/i;
const GAMING =
  /\b(game|gaming|gamer|playstation|xbox|nintendo|steam|valorant|csgo|cs2|dota|league of legends|fortnite|minecraft|roblox|genshin|fifa|fc24|fc25|pubg|apex|gta|cod|warzone)\b/i;
const ENTERTAINMENT =
  /\b(watch|watching|movie|movies|film|cinema|netflix|anime|manga|youtube|yt|tiktok|stream|streaming|scroll|scrolling|binge)\b/i;
const SLEEP_LEISURE =
  /\b(sleep|sleeping|nap|napping|rest|resting|gym|workout|working out|cardio|bicep|chest day|leg day|pushup|pullup|hangout|hanging out|date|party|partying|clubbing|chill|chilling)\b/i;
const FRAUD_SPAM =
  /\b(bullshit|free elo|free points|easy elo|boost|fake task|fake assignment|test task|test 123|asdf|qwerty)\b/i;

/**
 * Deterministic local fallback to determine if a task title represents legitimate academic coursework.
 * - Requires an enrolled course code for academic ranking.
 * - Flags chores, gaming, entertainment, sleep, and obvious spam as bullshit tasks.
 */
export function verifyTaskDeterministic(title: string, courseCode?: string | null): TaskVerificationResult {
  const t = title.trim();
  if (!t) {
    return { academic: false, bullshit: false, reason: "Task title cannot be empty" };
  }

  const code = (courseCode ?? "").trim().toUpperCase();
  const hasCourse = code.length > 0;
  const isCulinary = code.startsWith("CCBS") || code.startsWith("CCCK");

  // Obvious fraud / cheat strings
  if (FRAUD_SPAM.test(t)) {
    return { academic: false, bullshit: true, reason: "Invalid or exploit task title" };
  }

  // If it matches strong academic coursework keywords, it's considered academic
  const hasAcademicKeyword = ACADEMIC_KEYWORDS.test(t);

  // Check non-academic categories
  if (!hasAcademicKeyword) {
    if (CHORES.test(t) && !isCulinary) {
      return { academic: false, bullshit: true, reason: "Chores and domestic tasks are not academic coursework" };
    }
    if (GAMING.test(t)) {
      return { academic: false, bullshit: true, reason: "Video games and gaming sessions are not academic coursework" };
    }
    if (ENTERTAINMENT.test(t)) {
      return { academic: false, bullshit: true, reason: "Media, movies, and entertainment are not academic coursework" };
    }
    if (SLEEP_LEISURE.test(t)) {
      return { academic: false, bullshit: true, reason: "Sleep, fitness, and leisure activities are not academic coursework" };
    }
  }

  // If no course was selected, it's a personal to-do (not academic, but not a bum if it wasn't flagged)
  if (!hasCourse) {
    return { academic: false, bullshit: false, reason: "Ranked tasks must be linked to an enrolled course" };
  }

  return { academic: true, bullshit: false };
}
