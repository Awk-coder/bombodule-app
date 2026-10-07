import { useEffect, useState } from "preact/hooks";
import { ACHIEVEMENTS } from "../../domain/achievements";
import { apiUrl, call } from "../../online/api";
import type { PublicPlayer } from "../../online/api";
import { useAppState } from "../../store/store";
import { Chips } from "./Chips";
import { ORE_COLOR, ORE_NAME, RankBadge, divLabel } from "./RankBadge";
import { Sheet } from "./Sheet";

type Scope = "group" | "world";
type Load = { players: PublicPlayer[] } | { error: string } | null;

const seasonRank = (p: PublicPlayer) => (p.rated && p.ore ? `${ORE_NAME[p.ore]} ${divLabel(p.div)}`.trim() : "Unrated");

function PlayerSheet({ player, onClose }: { player: PublicPlayer | null; onClose: () => void }) {
  if (!player) return null;
  const kind = player.rated && player.ore ? player.ore : "unrated";
  return (
    <Sheet open onClose={onClose}>
      <div class="player">
        <RankBadge kind={kind} size={96} />
        <h2>{player.name}</h2>
        {player.title && <p class="player-title">{player.title}</p>}
        <div class="player-stats">
          <div>
            <small>Season</small>
            <b style={{ color: ORE_COLOR[kind] }}>{seasonRank(player)}</b>
            {player.rated && <span>{player.elo}</span>}
          </div>
          <div>
            <small>Degree</small>
            {player.degree ? (
              <b class="player-degree" style={{ color: ORE_COLOR[player.degree.ore] }}>
                <RankBadge kind={player.degree.ore} size={28} />
                {ORE_NAME[player.degree.ore]} · {player.degree.tier}
              </b>
            ) : (
              <b>Unranked</b>
            )}
          </div>
          <div>
            <small>Achievements</small>
            <b>{player.achievements} of {ACHIEVEMENTS.length}</b>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Friends and worldwide season boards; nothing at all when the app has no server. */
export function Leaderboard() {
  const state = useAppState();
  const season = state.semester?.label;
  const profile = state.profile;
  const [scope, setScope] = useState<Scope>(profile?.group ? "group" : "world");
  const [load, setLoad] = useState<Load>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<PublicPlayer | null>(null);
  const online = !!apiUrl() && !!season;
  const noGroup = scope === "group" && !profile?.group;

  useEffect(() => {
    if (!online || noGroup) return;
    let live = true;
    setLoad(null);
    call<{ players: PublicPlayer[] }>(`/board?scope=${scope}&season=${encodeURIComponent(season!)}`, { key: profile?.key }).then(
      (r) => live && setLoad({ players: r.players }),
      (e: Error) => live && setLoad({ error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [online, noGroup, scope, season, profile?.key, profile?.group, attempt]);

  if (!online) return null;
  return (
    <section class="leaderboard">
      <h2 class="section-title">Leaderboard</h2>
      <Chips options={[{ value: "group" as Scope, label: "Friends" }, { value: "world" as Scope, label: "World" }]} value={scope} onChange={setScope} />
      {!profile && <p class="group-hint lb-hint">Make a profile in <a href="#/settings">Settings</a> to show up here.</p>}
      {noGroup ? (
        <p class="group-hint lb-hint">Create or join a group in <a href="#/settings">Settings</a> to race your friends.</p>
      ) : load === null ? (
        <p class="group-hint lb-hint">Loading…</p>
      ) : "error" in load ? (
        <div class="card lb-error">
          <p class="error">{load.error}</p>
          <button class="btn ghost" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </div>
      ) : load.players.length === 0 ? (
        <p class="group-hint lb-hint">Nobody on this board yet this semester.</p>
      ) : (
        <div class="card lb-list">
          {load.players.map((p, i) => (
            <button key={p.id} class={`lb-row ${p.id === profile?.id ? "me" : ""}`} onClick={() => setOpen(p)}>
              <span class="lb-pos">{i + 1}</span>
              <RankBadge kind={p.rated && p.ore ? p.ore : "unrated"} size={32} />
              <span class="lb-name">
                <b>{p.name}</b>
                {p.title && <small>{p.title}</small>}
              </span>
              <span class="lb-elo">{p.rated ? p.elo : "Unrated"}</span>
            </button>
          ))}
        </div>
      )}
      <PlayerSheet player={open} onClose={() => setOpen(null)} />
    </section>
  );
}
