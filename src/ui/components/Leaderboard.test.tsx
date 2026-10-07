// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PublicPlayer } from "../../online/api";
import { dispatch } from "../../store/store";
import { Leaderboard } from "./Leaderboard";

const SEASON = "Sem 1, 2026/2027";
const p = (id: string, name: string, elo: number, over: Partial<PublicPlayer> = {}): PublicPlayer => ({
  id, name, title: null, season: SEASON, rated: true, elo, ore: "gold", div: 2, degree: null, achievements: 4, ...over,
});
let fetchMock: ReturnType<typeof vi.fn>;
const board = (players: PublicPlayer[]) => new Response(JSON.stringify({ players }), { status: 200 });

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.test");
  fetchMock = vi.fn(async () => board([p("a", "Alpha", 1050, { title: "Mr Perfect" }), p("me", "Wahid", 990)]));
  vi.stubGlobal("fetch", fetchMock);
  dispatch((s) => ({ ...s, semester: { label: SEASON, start: "2026-10-05", end: "2027-02-01" }, profile: { id: "me", key: "k", name: "Wahid", group: "ABC234" } }));
});
const roots: HTMLElement[] = [];
afterEach(() => {
  roots.splice(0).forEach((r) => render(null, r));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
async function mount() {
  const root = document.createElement("div");
  roots.push(root);
  await act(async () => render(<Leaderboard />, root));
  await settle();
  return root;
}
const button = (root: HTMLElement, t: string) => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes(t))!;

it("shows the friends board first, ranked, with titles and your own row marked", async () => {
  const root = await mount();
  expect(fetchMock.mock.calls[0][0]).toBe(`https://api.test/board?scope=group&season=${encodeURIComponent(SEASON)}`);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer k");
  const rows = root.querySelectorAll(".lb-row");
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("1");
  expect(rows[0].textContent).toContain("Alpha");
  expect(rows[0].textContent).toContain("Mr Perfect");
  expect(rows[0].textContent).toContain("1050");
  expect(rows[1].classList.contains("me")).toBe(true);
});

it("switches to the worldwide board", async () => {
  const root = await mount();
  await act(async () => button(root, "World").click());
  await settle();
  expect(fetchMock.mock.calls.at(-1)![0]).toContain("scope=world");
});

it("opens a player's profile with season and degree rank, never a CGPA", async () => {
  fetchMock.mockResolvedValueOnce(board([p("a", "Alpha", 1650, { ore: "diamond", div: 2, title: "Diamond Hands", degree: { ore: "emerald", tier: "B" }, achievements: 12 })]));
  const root = await mount();
  await act(async () => (root.querySelector(".lb-row") as HTMLElement).click());
  const sheet = root.querySelector(".sheet")!;
  expect(sheet.textContent).toContain("Alpha");
  expect(sheet.textContent).toContain("Diamond Hands");
  expect(sheet.textContent).toContain("Diamond II");
  expect(sheet.textContent).toContain("1650");
  expect(sheet.textContent).toContain("Emerald · B");
  expect(sheet.textContent).toContain("12 of");
  expect(sheet.textContent).not.toMatch(/\d\.\d\d/);
});

it("shows unrated players as Unrated", async () => {
  fetchMock.mockResolvedValueOnce(board([p("u", "Fresh", 0, { rated: false, ore: null, div: null })]));
  const root = await mount();
  expect(root.querySelector(".lb-row")!.textContent).toContain("Unrated");
});

it("shows the error with Retry instead of spinning forever", async () => {
  fetchMock.mockRejectedValueOnce(new TypeError("offline"));
  const root = await mount();
  expect(root.textContent).toContain("Can't reach the server");
  await act(async () => button(root, "Retry").click());
  await settle();
  expect(root.querySelectorAll(".lb-row")).toHaveLength(2);
});

it("points to Settings when there is no group yet", async () => {
  dispatch((s) => ({ ...s, profile: { id: "me", key: "k", name: "Wahid" } }));
  const root = await mount();
  expect(fetchMock.mock.calls[0][0]).toContain("scope=world");
  await act(async () => button(root, "Friends").click());
  expect(root.textContent).toContain("Create or join a group in Settings");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("shows the world board without a profile, with a nudge to make one", async () => {
  dispatch((s) => ({ ...s, profile: undefined }));
  const root = await mount();
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  expect(root.textContent).toContain("Make a profile in Settings");
});

it("is hidden when the app has no server", async () => {
  vi.stubEnv("VITE_API_URL", "");
  const root = await mount();
  expect(root.innerHTML).toBe("");
  expect(fetchMock).not.toHaveBeenCalled();
});
