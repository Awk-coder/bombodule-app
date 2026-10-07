import { useState } from "preact/hooks";
import { titleText, unlockedTitles } from "../../domain/titles";
import type { Profile } from "../../domain/types";
import { ApiError, apiUrl, call } from "../../online/api";
import { dispatch, useAppState } from "../../store/store";
import { IconChevron } from "./icons";
import { Sheet } from "./Sheet";

type Open = "create" | "rename" | "title" | "join" | "leave" | "delete" | null;

const setProfile = (p: Profile | undefined) => dispatch((s) => ({ ...s, profile: p }));

/** Settings → Profile: title, and with a server, the public profile and friends group. */
export function ProfileSection() {
  const state = useAppState();
  const profile = state.profile;
  const [open, setOpen] = useState<Open>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const title = state.title ? titleText(state, state.title) : null;

  const show = (o: Open, initial = "") => {
    setText(initial);
    setError(null);
    setOpen(o);
  };
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const create = () => run(async () => setProfile(await call<Profile>("/players", { method: "POST", body: { name: text } })));
  const rename = () => run(async () => {
    await call("/me", { method: "PATCH", key: profile!.key, body: { name: text } });
    setProfile({ ...profile!, name: text.trim().replace(/ +/g, " ") });
  });
  const newGroup = () => run(async () => {
    const { code } = await call<{ code: string }>("/groups", { method: "POST", key: profile!.key });
    setProfile({ ...profile!, group: code });
  });
  const join = () => run(async () => {
    const { code } = await call<{ code: string }>("/groups/join", { method: "POST", key: profile!.key, body: { code: text } });
    setProfile({ ...profile!, group: code });
  });
  const leave = () => run(async () => {
    await call("/groups/leave", { method: "POST", key: profile!.key });
    setProfile({ ...profile!, group: undefined });
  });
  const remove = () => run(async () => {
    try {
      await call("/me", { method: "DELETE", key: profile!.key });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e; // already gone on the server
    }
    setProfile(undefined);
  });

  const nameSheet = (heading: string, action: string, onSubmit: () => void, hint?: string) => (
    <>
      <h2>{heading}</h2>
      {hint && <p class="group-hint">{hint}</p>}
      <label class="field">
        <span>Name</span>
        <input maxLength={16} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      {error && <p class="error">{error}</p>}
      <button class="btn primary" disabled={busy || !text.trim()} onClick={onSubmit}>{action}</button>
      <button class="btn ghost" onClick={() => setOpen(null)}>Cancel</button>
    </>
  );

  return (
    <>
      <p class="group-title">Profile</p>
      <button class="row" onClick={() => show("title")}>
        <div class="grow"><b>Title</b><small>{title ?? "None"}</small></div>
        <IconChevron />
      </button>

      {apiUrl() && !profile && (
        <button class="row" onClick={() => show("create")}>
          <div class="grow"><b>Create profile</b><small>Join the worldwide and friends leaderboards</small></div>
          <IconChevron />
        </button>
      )}
      {apiUrl() && profile && (
        <>
          <button class="row" onClick={() => show("rename", profile.name)}>
            <div class="grow"><b>{profile.name}</b><small>Your name on the leaderboard · tap to rename</small></div>
            <IconChevron />
          </button>
          {profile.group ? (
            <div class="row">
              <div class="grow"><b>Friends group</b><small>Code <b class="group-code">{profile.group}</b> · share it so friends can join</small></div>
              <button class="link" onClick={() => show("leave")}>Leave group</button>
            </div>
          ) : (
            <>
              <button class="row" onClick={() => void newGroup()} disabled={busy}>
                <div class="grow"><b>Create group</b><small>Get a code to share with friends</small></div>
                <IconChevron />
              </button>
              <button class="row" onClick={() => show("join")}>
                <div class="grow"><b>Join group</b><small>Enter a friend's code</small></div>
                <IconChevron />
              </button>
            </>
          )}
          {error && !open && <p class="error">{error}</p>}
          <button class="row danger" onClick={() => show("delete")}>
            <div class="grow"><b>Delete profile</b><small>Removes you from every leaderboard</small></div>
          </button>
        </>
      )}

      <Sheet open={open !== null} onClose={() => setOpen(null)}>
        {open === "create" &&
          nameSheet("Create profile", "Create", () => void create(), "Your name, title, season rank, degree rank and achievement count will be public on the worldwide board. Your CGPA and results stay on this phone.")}
        {open === "rename" && nameSheet("Rename", "Save", () => void rename())}
        {open === "title" && (
          <>
            <h2>Title</h2>
            {unlockedTitles(state).length === 0 && <p class="group-hint">Unlock titles with achievements, or by reaching Diamond or Netherite in a season.</p>}
            <div class="title-list">
              {unlockedTitles(state).map((t) => (
                <button key={t.id} class={`row ${state.title === t.id ? "on" : ""}`} onClick={() => { dispatch((s) => ({ ...s, title: t.id })); setOpen(null); }}>
                  <b>{titleText(state, t.id)}</b>
                </button>
              ))}
              <button class="btn ghost" onClick={() => { dispatch((s) => ({ ...s, title: undefined })); setOpen(null); }}>No title</button>
            </div>
          </>
        )}
        {open === "join" && (
          <>
            <h2>Join group</h2>
            <label class="field">
              <span>Group code</span>
              <input maxLength={6} autoCapitalize="characters" value={text} onInput={(e) => setText(e.currentTarget.value)} />
            </label>
            {error && <p class="error">{error}</p>}
            <button class="btn primary" disabled={busy || !text.trim()} onClick={() => void join()}>Join</button>
            <button class="btn ghost" onClick={() => setOpen(null)}>Cancel</button>
          </>
        )}
        {open === "leave" && (
          <>
            <h2>Leave the group?</h2>
            <p class="group-hint">You can rejoin with the same code while anyone is still in it.</p>
            {error && <p class="error">{error}</p>}
            <button class="btn primary" disabled={busy} onClick={() => void leave()}>Leave</button>
            <button class="btn ghost" onClick={() => setOpen(null)}>Cancel</button>
          </>
        )}
        {open === "delete" && (
          <>
            <h2>Delete your profile?</h2>
            <p class="group-hint">You'll disappear from every leaderboard and lose your name. Your data on this phone stays.</p>
            {error && <p class="error">{error}</p>}
            <button class="btn primary danger" disabled={busy} onClick={() => void remove()}>Delete</button>
            <button class="btn ghost" onClick={() => setOpen(null)}>Cancel</button>
          </>
        )}
      </Sheet>
    </>
  );
}
