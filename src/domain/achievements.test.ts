import { describe, expect, it, vi } from "vitest";
import { ACHIEVEMENTS, earned, progressOf, recordAchievements } from "./achievements";
import { generateSessions } from "./sessions";
import { course, makeState, result, slot } from "./testState";
import { emptyState } from "./types";
import type { AppState, Mark, Task } from "./types";

const NOW = new Date("2026-10-12T12:00:00+08:00"); // mid-semester (makeState: Oct 5–18)
const AFTER = new Date("2026-10-20T12:00:00+08:00"); // semester over
const iso = (s: string) => new Date(s).toISOString();
const task = (over: Partial<Task>): Task => ({ id: crypto.randomUUID(), courseId: null, title: "t", due: iso("2026-10-10T23:59+08:00"), note: "", done: false, ...over });
const markAll = (s: AppState, now: Date, mark: Mark, filter = (_id: string) => true): AppState => {
  const marks = { ...s.marks };
  for (const x of generateSessions(s, now)) if (x.start < now && filter(x.id)) marks[x.id] = mark;
  return { ...s, marks };
};
const R = (label: string, grades: [string, string, number?][], over = {}) => result(label, grades, over);

type Case = [id: string, yes: () => [AppState, Date], no: () => [AppState, Date]];
const base = () => makeState();
const CASES: Case[] = [
  ["taking-inventory", () => [base(), NOW], () => [emptyState(), NOW]],
  ["roll-call", () => [markAll(base(), NOW, "attended"), NOW], () => [base(), new Date("2026-10-05T09:00+08:00")]],
  ["go-deeper", () => [base(), NOW], () => [base(), new Date("2026-10-06T12:00+08:00")]],
  ["the-end-q", () => [base(), AFTER], () => [base(), NOW]],
  ["the-end", () => [{ ...base(), examsDone: ["Sem 1, 2026/2027"], results: [R("Sem 1, 2026/2027", [["X 1000", "A"]])] }, AFTER], () => [{ ...base(), examsDone: ["Sem 1, 2026/2027"] }, AFTER]],
  ["results-in", () => [{ ...base(), examsDone: ["Sem 1, 2026/2027"], results: [R("Sem 1, 2026/2027", [["X 1000", "A"]])] }, AFTER], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1000", "A"]])] }, NOW]],
  ["the-end-again", () => [{ ...base(), examsDone: ["Sem 1, 2025/2026", "Sem 2, 2025/2026"], results: [R("Sem 1, 2025/2026", [["X 1", "A"]]), R("Sem 2, 2025/2026", [["X 2", "A"]])] }, NOW], () => [{ ...base(), examsDone: ["Sem 1, 2025/2026", "Sem 2, 2025/2026"], results: [R("Sem 1, 2025/2026", [["X 1", "A"]])] }, NOW]],
  ["next-generation", () => [{ ...base(), graduated: iso("2026-10-01"), results: [R("Sem 1, 2026/2027", [["X 1000", "A"]])] }, NOW], () => [{ ...base(), graduated: iso("2026-10-01") }, NOW]],
  ["full-house", () => [markAll(base(), AFTER, "attended", (id) => id.startsWith("BICS")), AFTER], () => [markAll(base(), NOW, "attended"), NOW]],
  ["perfect-record", () => [markAll(base(), AFTER, "attended"), AFTER], () => [markAll(base(), AFTER, "attended", (id) => id.startsWith("BICS")), AFTER]],
  ["serious-dedication", () => [{ ...base(), marks: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`s${i}@2026-01-01`, "attended" as Mark])) }, NOW], () => [markAll(base(), NOW, "attended"), NOW]],
  ["adventuring-time", () => {
    const slots = Array.from({ length: 10 }, (_, i) => ({ ...slot("BICS 4350-1", 1, `0${i}:00`.slice(-5), "23:00"), venue: `V${i}` }));
    return [{ ...base(), slots, marks: Object.fromEntries(slots.map((s) => [`${s.id}@2026-10-05`, "attended" as Mark])) }, NOW];
  }, () => [markAll(base(), NOW, "attended"), NOW]],
  ["sweet-dreams", () => [markAll(base(), NOW, "missed", (id) => id.startsWith("BIIT")), NOW], () => [markAll(base(), NOW, "missed", (id) => id.startsWith("BICS")), NOW]],
  ["not-today", () => {
    const s = { ...base(), courses: [{ ...course("BIIT 2301", "UX", 1), absenceLimit: 3 }] };
    return [markAll(s, AFTER, "missed"), AFTER]; // BIIT meets twice in the semester → 2 missed = limit − 1
  }, () => [markAll(base(), AFTER, "attended"), AFTER]],
  ["voluntary-exile", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1000", "Y"]])] }, NOW], () => [base(), NOW]],
  ["checked-off", () => [{ ...base(), tasks: [task({ done: true })] }, NOW], () => [{ ...base(), tasks: [task({})] }, NOW]],
  ["ten-down", () => [{ ...base(), tasks: Array.from({ length: 10 }, () => task({ done: true })) }, NOW], () => [{ ...base(), tasks: Array.from({ length: 9 }, () => task({ done: true })) }, NOW]],
  ["ahead-of-the-curve", () => [{ ...base(), tasks: [task({ done: true, completedAt: iso("2026-10-02T10:00+08:00") })] }, NOW], () => [{ ...base(), tasks: [task({ done: true, completedAt: iso("2026-10-05T10:00+08:00") })] }, NOW]],
  ["photo-finish", () => [{ ...base(), tasks: [task({ done: true, completedAt: iso("2026-10-10T23:30+08:00") })] }, NOW], () => [{ ...base(), tasks: [task({ done: true, completedAt: iso("2026-10-10T21:00+08:00") })] }, NOW]],
  ["monster-hunter", () => [{ ...base(), tasks: [task({ done: true, final: true })] }, NOW], () => [{ ...base(), tasks: [task({ final: true })] }, NOW]],
  ["monsters-hunted", () => [{ ...base(), tasks: [task({ done: true, final: true, courseId: "BICS 4350-1" }), task({ done: true, final: true, courseId: "BIIT 2301-1" })] }, NOW], () => [{ ...base(), tasks: [task({ done: true, final: true, courseId: "BICS 4350-1" })] }, NOW]],
  ["placement-match", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1000", "A"]])] }, NOW], () => [base(), NOW]],
  ["level-up", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1000", "C"]]), R("Sem 2, 2025/2026", [["Y 1000", "B"]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1000", "B"]]), R("Sem 2, 2025/2026", [["Y 1000", "C"]])] }, NOW]],
  ["overpowered", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["A 1", "A"], ["B 1", "A"], ["C 1", "A-"], ["D 1", "B+"]])] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["A 1", "A"], ["B 1", "A"], ["C 1", "A"], ["D 1", "D"]])] }, NOW]],
  ["flawless", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["A 1", "A"]])] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["A 1", "A-"]])] }, NOW]],
  ["top-of-the-class", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["A 1", "A-"]])] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["A 1", "B+"]])] }, NOW]],
  ["how-did-we-get-here", () => [{ ...base(), courses: base().courses.map((c) => ({ ...c, credits: 12 })) }, NOW], () => [{ ...base(), courses: base().courses.map((c) => ({ ...c, credits: 11 })) }, NOW]],
  ["redemption-arc", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "F"]]), R("Sem 2, 2025/2026", [["X 1", "C"]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "F"]])] }, NOW]],
  ["those-were-the-days", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "A"]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2026/2027", [["X 1", "A"]])] }, NOW]],
  ["deans-blessing", () => [{ ...base(), results: [R("Sem 2, 2025/2026", Array.from({ length: 7 }, (_, i): [string, string] => [`X ${i}`, "B"]))] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", Array.from({ length: 6 }, (_, i): [string, string] => [`X ${i}`, "B"]))] }, NOW]],
  ["summer-grind", () => [{ ...base(), results: [R("Sem 3, 2025/2026", [["X 1", "B"]])] }, NOW], () => [base(), NOW]],
  ["tactical-retreat", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "W"]])] }, NOW], () => [base(), NOW]],
  ["just-visiting", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "AU"]])] }, NOW], () => [base(), NOW]],
  ["skip-the-tutorial", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "EX"]])] }, NOW], () => [base(), NOW]],
  ["to-be-continued", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "IP"]])] }, NOW], () => [base(), NOW]],
  ["perfectionist", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "C"]]), R("Sem 2, 2025/2026", [["X 1", "B"]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "F"]]), R("Sem 2, 2025/2026", [["X 1", "B"]])] }, NOW]],
  ["last-chance-saloon", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "PR"]])] }, NOW], () => [base(), NOW]],
  ["objection", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "B"]], { regraded: true })] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "B"]])] }, NOW]],
  ["back-from-the-brink", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "D"]]), R("Sem 2, 2025/2026", [["Y 1", "A"]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "D"]])] }, NOW]],
  ["speedrun", () => [{ ...base(), semester: { ...base().semester!, label: "Sem 2, 2025/2026" }, graduated: iso("2026-10-01"), results: ["Sem 1, 2024/2025", "Sem 2, 2024/2025", "Sem 3, 2024/2025", "Sem 1, 2025/2026", "Sem 2, 2025/2026"].map((l) => R(l, [["X 1", "A"]])) }, NOW], () => [{ ...base(), graduated: iso("2026-10-01"), results: [R("Sem 1, 2024/2025", [["X 1", "A"]])] }, NOW]],
  ["balanced-diet", () => [{ ...base(), results: [R("Sem 2, 2025/2026", ["A", "A-", "B+", "B", "B-", "C+", "C", "D", "D-", "E", "F"].map((g, i): [string, string] => [`X ${i}`, g]))] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "A"]])] }, NOW]],
  ["bare-minimum", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "C"]])] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "C+"]])] }, NOW]],
  ["copy-paste", () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "B"], ["X 2", "B"]])] }, NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["X 1", "B"], ["X 2", "B+"]])] }, NOW]],
  ["fasting-scholar", () => {
    const s = makeState({ semester: { label: "Sem 2, 2026/2027", start: "2027-02-15", end: "2027-02-28" } });
    const after = new Date("2027-03-02T12:00+08:00");
    return [markAll(s, after, "attended"), after];
  }, () => [markAll(base(), AFTER, "attended"), AFTER]],
  ["what-am-i-doing", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "D"]], { status: "COND. PASS" }), R("Sem 3, 2025/2026", [["X 2", "A"]]), R("Sem 2, 2025/2026", [["X 3", "D"]], { status: "COND. PASS" })] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["X 1", "D"]], { status: "COND. PASS" }), R("Sem 2, 2025/2026", [["X 3", "A"]])] }, NOW]],
  ["lock-in", () => [{ ...base(), results: ["Sem 1, 2024/2025", "Sem 2, 2024/2025", "Sem 1, 2025/2026", "Sem 2, 2025/2026"].map((l) => R(l, [["X 1", "D"]], { status: "COND. PASS" })) }, NOW], () => [{ ...base(), results: ["Sem 1, 2024/2025", "Sem 2, 2024/2025", "Sem 1, 2025/2026"].map((l) => R(l, [["X 1", "D"]], { status: "COND. PASS" })) }, NOW]],
  ["we-need-to-cook", () => [makeState({ courses: [course("CCCK 1010", "COOKING")] }), NOW], () => [{ ...base(), results: [R("Sem 2, 2025/2026", [["CCFM 2061", "A"]])] }, NOW]],
  ["master-baker", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["CCBS 1010", "B", 0.5]]), R("Sem 2, 2025/2026", [["CCBS 2010", "A", 0.5]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["CCBS 1010", "B", 0.5]]), R("Sem 2, 2025/2026", [["CCBS 2010", "F", 0.5], ["CCCK 1010", "A", 0.5]])] }, NOW]],
  ["gordons-protege", () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["CCCK 1010", "P", 0.5], ["CCCK 2010", "A-", 0.5]])] }, NOW], () => [{ ...base(), results: [R("Sem 1, 2025/2026", [["CCCK 1010", "A", 0.5], ["CCBS 2010", "A", 0.5]])] }, NOW]],
];

describe("achievements", () => {
  it("has 49 unique ids, 18 secret, and a case for each", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(49);
    expect(ACHIEVEMENTS.filter((a) => a.secret)).toHaveLength(18);
    expect(CASES.map((c) => c[0]).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });

  it.each(CASES)("%s", (id, yes, no) => {
    expect(earned(...yes())).toContain(id);
    expect(earned(...no())).not.toContain(id);
  });

  it("records new unlocks once and keeps the first time", () => {
    const a = recordAchievements(base(), NOW);
    expect(a.achievements["taking-inventory"]).toBe(NOW.toISOString());
    expect(recordAchievements(a, AFTER).achievements["taking-inventory"]).toBe(NOW.toISOString());
    const settled = recordAchievements(a, NOW);
    expect(settled).toBe(a);
  });
});

it("skips the Hijri calendar while the semester is running", () => {
  const spy = vi.spyOn(Intl, "DateTimeFormat");
  earned(markAll(base(), NOW, "attended"), NOW);
  expect(spy.mock.calls.filter((c) => String(c[0]).includes("islamic"))).toHaveLength(0);
  spy.mockRestore();
});

describe("achievement progress", () => {
  it("counts toward goals like Ten Down", () => {
    const s = base();
    const tasks = [1, 2, 3].map(() => task({ done: true, completedAt: iso("2026-10-09T12:00+08:00") }));
    expect(progressOf({ ...s, tasks }, NOW, "ten-down")).toEqual([3, 10]);
  });

  it("counts cooking levels passed", () => {
    expect(progressOf({ ...base(), results: [R("Sem 1, 2025/2026", [["CCCK 1010", "A", 0.5]])] }, NOW, "gordons-protege")).toEqual([1, 2]);
  });

  it("has no progress for one-off achievements", () => {
    expect(progressOf(base(), NOW, "roll-call")).toBeNull();
  });

  it("every secret achievement has a hint", () => {
    for (const a of ACHIEVEMENTS.filter((x) => x.secret)) expect(a.hint, a.id).toBeTruthy();
  });
});
