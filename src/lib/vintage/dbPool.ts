import { Pool } from "pg";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";

let pool: Pool | undefined;
let revisionHistoryCleanup: Promise<void> | undefined;

/** True when `VINTAGE_DATABASE_URL` is configured (Neon vintage branch). */
export function hasVintageDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
}

/**
 * Best-effort removal of legacy CMS revision history (tables may lack DROP rights).
 */
async function purgeLegacyRevisionHistory(activePool: Pool): Promise<void> {
  try {
    await activePool.query(`
      DROP TABLE IF EXISTS vintage_homepage_revisions;
      DROP TABLE IF EXISTS vintage_info_revisions;
    `);
  } catch {
    try {
      await activePool.query(`
        DELETE FROM vintage_homepage_revisions;
        DELETE FROM vintage_info_revisions;
      `);
    } catch {
      // App role may lack privileges; editors no longer read these tables.
    }
  }
}

/**
 * Shared pg pool for all vintage CMS stores. Never falls back to the bracket database.
 */
export function getVintageDbPool(): Pool {
  if (!isVintageEnabled()) throw new Error("Vintage is disabled.");
  const connectionString = process.env.VINTAGE_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Set VINTAGE_DATABASE_URL to a dedicated vintage database.",
    );
  }
  assertDedicatedVintageDatabase(connectionString);
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
    });
    revisionHistoryCleanup ??= purgeLegacyRevisionHistory(pool);
  }
  return pool;
}
