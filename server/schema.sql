CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,    -- lowercased, for case-insensitive uniqueness
  key_hash TEXT NOT NULL UNIQUE,    -- SHA-256 of the phone's secret key
  title TEXT,
  season TEXT,                      -- "Sem 1, 2026/2027"
  rated INTEGER NOT NULL DEFAULT 0,
  elo INTEGER NOT NULL DEFAULT 0,
  degree_ore TEXT,
  degree_tier TEXT,
  achievements INTEGER NOT NULL DEFAULT 0,
  group_id TEXT REFERENCES groups(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS players_board ON players (season, rated, elo);
CREATE INDEX IF NOT EXISTS players_group ON players (group_id);
