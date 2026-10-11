// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dispatch, getState } from "../../store/store";
import { Onboarding } from "./Onboarding";

let fetchMock: ReturnType<typeof vi.fn>;
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const roots: HTMLElement[] = [];
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.test");
  fetchMock = vi.fn(async () => res(204));
  vi.stubGlobal("fetch", fetchMock);
  dispatch((s) => ({ ...s, onboarded: false, courses: [], semester: null, profile: undefined }));
});
afterEach(() => {
  roots.splice(0).forEach((r) => render(null, r));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const button = (root: HTMLElement, t: string) => [...root.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === t);
async function click(root: HTMLElement, t: string) {
  await act(async () => button(root, t)!.click());
  await settle();
}
async function type(root: HTMLElement, label: string, value: string) {
  const input = [...root.querySelectorAll("label")].find((l) => l.textContent?.includes(label))!.querySelector("input")!;
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  });
}
async function toLeaderboardStep() {
  const root = document.createElement("div");
  roots.push(root);
  await act(async () => render(<Onboarding />, root));
  await click(root, "Skip for now");
  return root;
}

it("offers a leaderboard profile with a blank name and says what is public", async () => {
  const root = await toLeaderboardStep();
  expect(root.querySelector("h1")!.textContent).toBe("Join the leaderboard");
  expect(root.textContent).toContain("public");
  expect(root.querySelector("input")!.value).toBe("");
});

it("creates the profile, joins a friend's group, then moves on", async () => {
  fetchMock.mockResolvedValueOnce(res(201, { id: "p1", key: "secret", name: "Wahid" })).mockResolvedValueOnce(res(200, { code: "ABC234" }));
  const root = await toLeaderboardStep();
  await type(root, "Name", "Wahid");
  await type(root, "group code", "abc234");
  await click(root, "Create profile");
  expect(getState().profile).toEqual({ id: "p1", key: "secret", name: "Wahid", group: "ABC234" });
  expect(root.querySelector("h1")!.textContent).toBe("Notifications");
});

it("keeps the new profile and stays put when the group code is wrong", async () => {
  fetchMock.mockResolvedValueOnce(res(201, { id: "p1", key: "secret", name: "Wahid" })).mockResolvedValueOnce(res(404, { error: "No group with that code" }));
  const root = await toLeaderboardStep();
  await type(root, "Name", "Wahid");
  await type(root, "group code", "zzzzzz");
  await click(root, "Create profile");
  expect(root.textContent).toContain("No group with that code");
  expect(getState().profile?.id).toBe("p1");
  fetchMock.mockResolvedValueOnce(res(200, { code: "XYZ789" }));
  await type(root, "group code", "xyz789");
  await click(root, "Join group");
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(getState().profile?.group).toBe("XYZ789");
  expect(root.querySelector("h1")!.textContent).toBe("Notifications");
});

it("shows a taken name and lets you skip", async () => {
  fetchMock.mockResolvedValueOnce(res(409, { error: "Name taken" }));
  const root = await toLeaderboardStep();
  await type(root, "Name", "Wahid");
  await click(root, "Create profile");
  expect(root.textContent).toContain("Name taken");
  await click(root, "Skip");
  expect(getState().profile).toBeUndefined();
  expect(root.querySelector("h1")!.textContent).toBe("Notifications");
});

it("skips the step without a server", async () => {
  vi.stubEnv("VITE_API_URL", "");
  const root = await toLeaderboardStep();
  expect(root.querySelector("h1")!.textContent).toBe("Notifications");
});
