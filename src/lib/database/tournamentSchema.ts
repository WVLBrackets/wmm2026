import type { Pool, PoolClient } from 'pg';

/** Additive migration; intentionally separate from historical tournament JSON. */
export async function initializeTournamentWorkspace(db: Pick<Pool | PoolClient, 'query'>): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS tournament_workspaces (
    scope TEXT NOT NULL, year INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
    draft JSONB, published JSONB, results JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by TEXT NOT NULL,
    PRIMARY KEY (scope, year)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS tournament_workspace_history (
    id BIGSERIAL PRIMARY KEY, scope TEXT NOT NULL, year INTEGER NOT NULL,
    revision INTEGER NOT NULL, action TEXT NOT NULL, payload JSONB NOT NULL,
    actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope, year, revision)
  )`);
}
