/**
 * Cached public scoreboard payload (standings-style snapshot).
 * Public pages read this row only; rebuild happens on admin write.
 */

import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { initializeDatabase } from '@/lib/database/migrations';
import type { ScoreboardYearSnapshot } from '@/lib/types/publicScoreboard';

async function ensureTable(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS scoreboard_snapshots (
        environment VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        payload JSONB NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (environment, year)
      )
    `;
  } catch (error) {
    console.warn('[scoreboardSnapshotRepository] ensureTable:', error);
    await initializeDatabase();
  }
}

/**
 * Persist (replace) the public scoreboard snapshot for a year.
 */
export async function upsertScoreboardSnapshot(
  year: number,
  payload: ScoreboardYearSnapshot,
): Promise<void> {
  await ensureTable();
  const environment = getCurrentEnvironment();
  const computedAt = payload.computedAt || new Date().toISOString();
  await sql`
    INSERT INTO scoreboard_snapshots (environment, year, payload, computed_at)
    VALUES (
      ${environment},
      ${year},
      ${JSON.stringify({ ...payload, computedAt })},
      ${computedAt}
    )
    ON CONFLICT (environment, year)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      computed_at = EXCLUDED.computed_at
  `;
}

/**
 * Read the cached public scoreboard for a year, or null if never built.
 * Avoids DDL on the hot public path — missing table ⇒ null ⇒ empty board.
 */
export async function getScoreboardSnapshot(
  year: number,
): Promise<ScoreboardYearSnapshot | null> {
  const environment = getCurrentEnvironment();
  try {
    const result = await sql`
      SELECT payload FROM scoreboard_snapshots
      WHERE environment = ${environment} AND year = ${year}
      LIMIT 1
    `;
    if (result.rows.length === 0) return null;
    let raw: unknown = result.rows[0].payload;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!raw || typeof raw !== 'object') return null;
    const snap = raw as ScoreboardYearSnapshot;
    if (
      !Array.isArray(snap.pages) ||
      typeof snap.bySlug !== 'object' ||
      !snap.bySlug
    ) {
      return null;
    }
    return snap;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/does not exist|scoreboard_snapshots/i.test(message)) {
      return null;
    }
    throw error;
  }
}
