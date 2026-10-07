// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dispatch, getState } from "../../store/store";
import { ProfileSection } from "./ProfileSection";

let fetchMock: ReturnType<typeof vi.fn>;
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const roots: HTMLElement[] = [];
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.test");
  fetchMock = vi.fn(async () => res(204));
  vi.stubGlobal("fetch", fetchMock);
  dispatch((s) => ({ ...s, profile: undefined, title: undefined, achievements: {}, rankPeaks: {} }));
});
afterEach(() => {
  roots.splice(0).forEach((r) => render(null, r));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function mount() {
  const root = document.createElement("div");
  roots.push(root);
  await act(async () => render(<ProfileSection />, root));
  return root;
}
const button = (root: HTMLElement, t: string) =>
  [...(root.querySelector(".sheet") ?? root).querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes(t))!;
async function type(root: HTMLElement, value: string) {
  const input = root.querySelector<HTMLInputElement>(".sheet input")!;
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  });
}
async function click(root: HTMLElement, t: string) {
  await act(async () => button(root, t).click());
  await settle();
}
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, method: init.method, auth: init.headers.Authorization, body: init.body && JSON.parse(init.body) };
};

it("creates a profile after saying it is public", async () => {
  fetchMock.mockResolvedValueOnce(res(201, { id: "p1", key: "secret", name: "Wahid" }));
  const root = await mount();
  await click(root, "Create profile");
  expect(root.querySelector(".sheet")!.textContent).toContain("public");
  await type(root, "Wahid");
  await click(root, "Create");
  expect(lastCall()).toMatchObject({ url: "https://api.test/players", method: "POST", body: { name: "Wahid" } });
  expect(getState().profile).toEqual({ id: "p1", key: "secret", name: "Wahid" });
  expect(root.querySelector(".sheet")).toBeNull();
});

it("says when a name is taken", async () => {
  fetchMock.mockResolvedValueOnce(res(409, { error: "Name taken" }));
  const root = await mount();
  await click(root, "Create profile");
  await type(root, "Wahid");
  await click(root, "Create");
  expect(root.querySelector(".sheet")!.textContent).toContain("Name taken");
  expect(getState().profile).toBeUndefined();
});

it("renames", async () => {
  dispatch((s) => ({ ...s, profile: { id: "p1", key: "secret", name: "Wahid" } }));
  const root = await mount();
  await click(root, "Wahid");
  await type(root, "Abdul");
  await click(root, "Save");
  expect(lastCall()).toMatchObject({ url: "https://api.test/me", method: "PATCH", auth: "Bearer secret", body: { name: "Abdul" } });
  expect(getState().profile!.name).toBe("Abdul");
});

it("picks only unlocked titles, or none", async () => {
  dispatch((s) => ({ ...s, achievements: { flawless: "x" } }));
  const root = await mount();
  await click(root, "Title");
  const sheet = root.querySelector(".sheet")!;
  expect(sheet.textContent).toContain("Mr Perfect");
  expect(sheet.textContent).not.toContain("Speedrunner");
  await click(root, "Mr Perfect");
  expect(getState().title).toBe("flawless");
  await click(root, "Title");
  await click(root, "No title");
  expect(getState().title).toBeUndefined();
});

it("creates, leaves and joins a friends group", async () => {
  dispatch((s) => ({ ...s, profile: { id: "p1", key: "secret", name: "Wahid" } }));
  const root = await mount();
  fetchMock.mockResolvedValueOnce(res(200, { code: "ABC234" }));
  await click(root, "Create group");
  expect(lastCall()).toMatchObject({ url: "https://api.test/groups", method: "POST", auth: "Bearer secret" });
  expect(getState().profile!.group).toBe("ABC234");
  expect(root.textContent).toContain("ABC234");

  await click(root, "Leave group");
  await click(root, "Leave");
  expect(lastCall()).toMatchObject({ url: "https://api.test/groups/leave" });
  expect(getState().profile!.group).toBeUndefined();

  fetchMock.mockResolvedValueOnce(res(404, { error: "No group with that code" }));
  await click(root, "Join group");
  await type(root, "zzzzzz");
  await click(root, "Join");
  expect(root.querySelector(".sheet")!.textContent).toContain("No group with that code");
  fetchMock.mockResolvedValueOnce(res(200, { code: "XYZ789" }));
  await type(root, "xyz789");
  await click(root, "Join");
  expect(lastCall()).toMatchObject({ url: "https://api.test/groups/join", body: { code: "xyz789" } });
  expect(getState().profile!.group).toBe("XYZ789");
});

it("deletes the profile after confirming, even if the server already forgot it", async () => {
  dispatch((s) => ({ ...s, profile: { id: "p1", key: "secret", name: "Wahid" } }));
  fetchMock.mockResolvedValueOnce(res(401, { error: "Unknown player" }));
  const root = await mount();
  await click(root, "Delete profile");
  await click(root, "Delete");
  expect(lastCall()).toMatchObject({ url: "https://api.test/me", method: "DELETE" });
  expect(getState().profile).toBeUndefined();
});

it("keeps the title picker but hides online rows without a server", async () => {
  vi.stubEnv("VITE_API_URL", "");
  const root = await mount();
  expect(button(root, "Title")).toBeTruthy();
  expect(button(root, "Create profile")).toBeUndefined();
});
