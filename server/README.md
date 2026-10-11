# Bombodule leaderboard API

Cloudflare Worker + D1 behind profiles, friends groups and the worldwide board. API: `docs/superpowers/specs/2026-10-07-leaderboard-design.md`.

Tests run with the app's suite (`npm test` at the repo root) against an in-memory SQLite stand-in for D1, so they need no Cloudflare account.

## Deploy (free plan is plenty)

From this folder, after making a Cloudflare account:

```sh
npx wrangler login
npx wrangler d1 create bombodule              # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute bombodule --remote --file schema.sql
npx wrangler deploy                           # prints https://bombodule-api.<you>.workers.dev
```

Then build the app with that URL:

```sh
echo 'VITE_API_URL=https://bombodule-api.<you>.workers.dev' > ../.env.local
```

Without `VITE_API_URL` the app hides every online feature.
