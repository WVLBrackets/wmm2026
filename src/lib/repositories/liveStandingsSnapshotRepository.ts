/**
 * Persisted live standings (recomputed when the KEY bracket is saved).
 */

import { sql } from '../databaseAdapter';
import { getCurrentEnvironment } from '../databaseConfig';
import { initializeDatabase } from '../database/migrations';

export interface LiveStandingsEntry {
  bracketId: string;
  entryName: string;
  userName: string;
  userEmail: string;
  points: number;
  /** Competition rank (ties share the same rank; next rank skips). */
  rank: number;
}

export interface LiveStandingsSnapshot {
  year: number;
  keyBracketId: string;
  keyUpdatedAt: Date;
  computedAt: Date;
  entries: LiveStandingsEntry[];
}

async function ensureTable(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS live_standings_snapshots (
        environment VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        key_bracket_id VARCHAR(36) NOT NULL,
        key_updated_at TIMESTAMPTZ NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        entries JSONB NOT NULL,
        PRIMARY KEY (environment, year)
      )
    `;
  } catch (error) {
    console.warn('[liveStandingsSnapshotRepository] ensureTable:', error);
    await initializeDatabase();
  }
}

/**
 * Replace the snapshot for an environment + tournament year.
 */
export async function upsertLiveStandingsSnapshot(
  year: number,
  keyBracketId: string,
  keyUpdatedAt: Date,
  entries: LiveStandingsEntry[]
): Promise<void> {
  await ensureTable();
  const environment = getCurrentEnvironment();

  await sql`
    INSERT INTO live_standings_snapshots (
      environment,
      year,
      key_bracket_id,
      key_updated_at,
      computed_at,
      entries
    )
    VALUES (
      ${environment},
      ${year},
      ${keyBracketId},
      ${keyUpdatedAt.toISOString()},
      ${new Date().toISOString()},
      ${JSON.stringify(entries)}
    )
    ON CONFLICT (environment, year)
    DO UPDATE SET
      key_bracket_id = EXCLUDED.key_bracket_id,
      key_updated_at = EXCLUDED.key_updated_at,
      computed_at = EXCLUDED.computed_at,
      entries = EXCLUDED.entries
  `;
}

/**
 * Latest snapshot for the year, or null if never computed.
 */
export async function getLiveStandingsSnapshot(year: number): Promise<LiveStandingsSnapshot | null> {
  await ensureTable();
  const environment = getCurrentEnvironment();

  const result = await sql`
    SELECT year, key_bracket_id, key_updated_at, computed_at, entries
    FROM live_standings_snapshots
    WHERE environment = ${environment} AND year = ${year}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as Record<string, unknown>;
  let entriesRaw = row.entries;
  if (typeof entriesRaw === 'string') {
    try {
      entriesRaw = JSON.parse(entriesRaw) as LiveStandingsEntry[];
    } catch {
      entriesRaw = [];
    }
  }
  return {
    year: row.year as number,
    keyBracketId: row.key_bracket_id as string,
    keyUpdatedAt: new Date(row.key_updated_at as string),
    computedAt: new Date(row.computed_at as string),
    entries: Array.isArray(entriesRaw) ? (entriesRaw as LiveStandingsEntry[]) : [],
  };
}
