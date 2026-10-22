import { Pool } from "pg";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";

let pool: Pool | undefined;

/** True when `VINTAGE_DATABASE_URL` is configured (Neon vintage branch). */
export function hasVintageDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
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
  pool ??= new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
  return pool;
}
