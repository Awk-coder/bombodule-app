# Profiles, leaderboard and titles

Uni app only. Agreed in chat 2026-10-07; the user said "go ahead and build" after the server section, so the app-side choices below were made without a separate review and are listed under Rulings.

## Agreed with the user

- Leaderboards rank by **season Elo only**. Two boards: the player's one **friends group** (invite code) and **worldwide**.
- Everyone with a profile is on the worldwide board automatically. Making a profile is optional; without one the app stays fully offline.
- Tapping a player opens a small profile: name, title, season rank + Elo, degree rank (badge + tier, never CGPA), achievement count.
- **Unique names**, case-insensitive, 3–16 of letters, digits, space, underscore.
- **Titles**, one shown under the name:
  - a hand-picked set of achievements unlock one each;
  - reaching **Diamond** or **Netherite** in a season unlocks that rank's title. It shows plainly for the rest of that semester and all of the next; if the next semester passes without reaching that rank again it reads "Fallen …" until the rank is reached again.
- Server: Cloudflare Worker + D1, in `server/`. Phone identifies itself with a random key; server stores only its SHA-256 hash.
- Boards only list players on the viewer's semester label. Server rejects Elo outside 0–5000 and more than one stats update per player per 10 s; it works out the season rank from the Elo itself, so a phone can't claim a rank its Elo doesn't earn.

## Server API

All JSON. `Authorization: Bearer <key>` where marked (auth).

| Method | Path | Body | Result |
|---|---|---|---|
| POST | /players | `{ name }` | `201 { id, key, name }`, `409` name taken, `400` invalid |
| GET | /me (auth) | | `{ player }`, with the group code as `player.group` |
| PATCH | /me (auth) | `{ name?, title?, stats? }` | `204`, `409` name taken, `429` too soon |
| DELETE | /me (auth) | | `204` |
| POST | /groups (auth) | | `{ code }` (creator joins, leaves any old group) |
| POST | /groups/join (auth) | `{ code }` | `{ code }`, `404` |
| POST | /groups/leave (auth) | | `204` |
| GET | /board?scope=world\|group&season=… (auth for group) | | `{ players }`, top 100 |
| GET | /players/:id | | public profile |

`stats` = `{ season, rated, elo, degreeOre, degreeTier, achievements }`. The server derives the season rank from Elo itself (shared `rankOf`) and validates `title` against the shared title list.

## App

- `src/domain/titles.ts`: title list, unlocked titles, display text with the Fallen rule. Shared with the server.
- `AppState` gains `profile?: { id, key, name }`, `title?: string`, `rankPeaks: Record<semesterLabel, Ore>` (highest ore reached in that season, recorded like achievements).
- `src/online/`: API client (base URL from `VITE_API_URL`; with none set, all online UI is hidden), stats snapshot, debounced push on change (retry after 429/offline).
- Ranked: title under the season rank; Leaderboard section with Friends / World tabs; player sheet. Load failure shows an error with Retry, never an endless spinner.
- Settings → Profile: create (with a note that the profile is public), rename, title picker, create / join / leave group, delete profile. The key travels in Export data, so a backup restores the profile.

## Rulings (decided without review)

- Title names (editable later): Flawless → "Mr Perfect", Perfect Record → "The One and Only", Top of the Class → "Top of the Class", Overpowered → "Dean's Lister", Serious Dedication → "Ever Present", Monsters Hunted → "Monster Slayer", Speedrun → "Speedrunner", Redemption Arc → "Redeemed", Back from the Brink → "Comeback Kid", Not Today → "Living on the Edge", Voluntary Exile → "Exiled", A Balanced Diet → "Grade Collector", You Need to Lock In → "Needs to Lock In", Fasting Scholar → "Fasting Scholar", The Next Generation → "Graduate". Ranks: Diamond → "Diamond Hands", Netherite → "Netherite Grinder".
- Reaching Netherite also counts as reaching Diamond.
- "The next semester" is the latest semester the app has recorded before the current one.
- No name moderation beyond the character rules; deleting a profile is the remedy.
- Unrated players are listed below rated ones.
- Only stats pushes are rate-limited; renames, titles and group changes are not.
- The group code is kept on the phone (`profile.group`) so Settings and the boards need no extra request.
- The board rows already carry the whole public profile, so tapping a player opens the sheet instantly with no fetch.
- The title picker works without a server (titles show under your season rank either way).
- Deleting a profile the server no longer knows still clears it from the phone.
- Group codes are 6 characters from A–Z and 2–9 without I, O, 0 and 1; joining ignores case.
