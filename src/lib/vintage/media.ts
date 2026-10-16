import { Pool } from "pg";
export interface VintageMedia {
  id: string;
  url: string;
  filename: string;
  alt: string;
}
/** Metadata uses the same dedicated connection as vintage content, with no application DB fallback. */
export async function mediaDatabase(): Promise<Pool> {
  // Exercise the content store's environment and database-isolation checks first.
  const { readVintageState, hasVintageDatabase } = await import("./store");
  if (!hasVintageDatabase())
    throw new Error("Vintage storage is not configured.");
  await readVintageState();
  return new Pool({
    connectionString: process.env.VINTAGE_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
}
export async function listVintageMedia(): Promise<VintageMedia[]> {
  const pool = await mediaDatabase();
  try {
    return (
      await pool.query(
        "SELECT id, url, filename, alt FROM vintage_homepage_media ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
  } finally {
    await pool.end();
  }
}
