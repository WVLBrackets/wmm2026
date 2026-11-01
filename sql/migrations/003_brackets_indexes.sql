-- Bracket lookup indexes from createIndexes() in src/lib/database/migrations.ts.

CREATE INDEX IF NOT EXISTS idx_brackets_env_user_year ON brackets(environment, user_id, year);
CREATE INDEX IF NOT EXISTS idx_brackets_env_year_status ON brackets(environment, year, status);
