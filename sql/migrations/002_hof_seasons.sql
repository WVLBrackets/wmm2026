-- Hall of Fame podium history (retired Google Sheet).
-- Mirrors createHofSeasonsTable() in src/lib/database/migrations.ts.

CREATE TABLE IF NOT EXISTS hof_seasons (
  year VARCHAR(8) PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  first_team TEXT NOT NULL DEFAULT '',
  first_score INTEGER NOT NULL DEFAULT 0,
  second_name TEXT NOT NULL DEFAULT '',
  second_score INTEGER NOT NULL DEFAULT 0,
  third_name TEXT NOT NULL DEFAULT '',
  third_score INTEGER NOT NULL DEFAULT 0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
