/**
 * Persisted live standings (recomputed when the KEY bracket is saved).
 * `entries` JSONB stores a full {@link StandingsData} blob (same shape as daily sheet assembly).
 */

import type { StandingsData } from '@/lib/standingsData';
import { sql } from '../databaseAdapter';
import { getCurrentEnvironment } from '../databaseConfig';
import { initializeDatabase } from '../database/migrations';

export interface LiveStandingsSnapshot {
  year: number;
  keyBracketId: string;
  keyUpdatedAt: Date;
  computedAt: Date;
  standingsData: StandingsData;
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

function parseStandingsDataPayload(raw: unknown): StandingsData | null {
  if (raw == null) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(data)) return null;
    if (data && typeof data === 'object' && Array.isArray((data as StandingsData).entries)) {
      return data as StandingsData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Replace the snapshot for an environment + tournament year.
 */
export async function upsertLiveStandingsSnapshot(
  year: number,
  keyBracketId: string,
  keyUpdatedAt: Date,
  standingsData: StandingsData
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
      ${JSON.stringify(standingsData)}
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
 * Latest snapshot for the year, or null if never computed or legacy row format.
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
      entriesRaw = JSON.parse(entriesRaw);
    } catch {
      entriesRaw = null;
    }
  }
  const standingsData = parseStandingsDataPayload(entriesRaw);
  if (!standingsData) {
    return null;
  }

  return {
    year: row.year as number,
    keyBracketId: row.key_bracket_id as string,
    keyUpdatedAt: new Date(row.key_updated_at as string),
    computedAt: new Date(row.computed_at as string),
    standingsData,
  };
}
