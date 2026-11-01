/**
 * Hall of Fame podium history (retired Google Sheet).
 */

import { sql } from "@/lib/databaseAdapter";
import type { HallOfFameEntry } from "@/lib/hallOfFameStats";
import { HOF_SEASONS_SEED } from "@/lib/hofSeasonsSeed";

let tableReady = false;

/**
 * Ensure the hof_seasons table exists (idempotent).
 */
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await sql`
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
    )
  `;
  tableReady = true;
}

function mapRow(row: Record<string, unknown>): HallOfFameEntry {
  return {
    year: String(row.year ?? ""),
    firstPlace: {
      name: String(row.first_name ?? ""),
      team: String(row.first_team ?? ""),
      score: Number(row.first_score) || 0,
    },
    secondPlace: {
      name: String(row.second_name ?? ""),
      score: Number(row.second_score) || 0,
    },
    thirdPlace: {
      name: String(row.third_name ?? ""),
      score: Number(row.third_score) || 0,
    },
    totalEntries: Number(row.total_entries) || 0,
  };
}

/**
 * Seed from the bundled historical snapshot when the table is empty.
 */
export async function seedHofSeasonsIfEmpty(): Promise<void> {
  await ensureTable();
  const count = await sql`SELECT COUNT(*)::int AS n FROM hof_seasons`;
  if ((count.rows[0]?.n as number) > 0) return;
  for (const entry of HOF_SEASONS_SEED) {
    await upsertHofSeason(entry);
  }
}

/**
 * Insert or replace one Hall of Fame season.
 *
 * @param entry - Podium row
 */
export async function upsertHofSeason(entry: HallOfFameEntry): Promise<void> {
  await ensureTable();
  await sql`
    INSERT INTO hof_seasons (
      year, first_name, first_team, first_score,
      second_name, second_score, third_name, third_score, total_entries, updated_at
    ) VALUES (
      ${entry.year}, ${entry.firstPlace.name}, ${entry.firstPlace.team}, ${entry.firstPlace.score},
      ${entry.secondPlace.name}, ${entry.secondPlace.score},
      ${entry.thirdPlace.name}, ${entry.thirdPlace.score},
      ${entry.totalEntries}, now()
    )
    ON CONFLICT (year) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      first_team = EXCLUDED.first_team,
      first_score = EXCLUDED.first_score,
      second_name = EXCLUDED.second_name,
      second_score = EXCLUDED.second_score,
      third_name = EXCLUDED.third_name,
      third_score = EXCLUDED.third_score,
      total_entries = EXCLUDED.total_entries,
      updated_at = now()
  `;
}

/**
 * All Hall of Fame seasons, newest year first.
 * Creates and seeds the table once when an environment has not run migrations yet.
 */
export async function listHofSeasons(): Promise<HallOfFameEntry[]> {
  await ensureTable();
  await seedHofSeasonsIfEmpty();
  const result = await sql`
    SELECT * FROM hof_seasons
    ORDER BY year DESC
  `;
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

/**
 * Delete a season row.
 *
 * @param year - Year key
 */
export async function deleteHofSeason(year: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM hof_seasons WHERE year = ${year}`;
}
