import { getVintageDbPool, hasVintageDatabase } from "./dbPool";

export interface VintageMedia {
  id: string;
  url: string;
  filename: string;
  alt: string;
}

/** Metadata uses the same dedicated connection as vintage content, with no application DB fallback. */
export async function mediaDatabase() {
  if (!hasVintageDatabase()) {
    throw new Error("Vintage storage is not configured.");
  }
  return getVintageDbPool();
}

export async function listVintageMedia(): Promise<VintageMedia[]> {
  const pool = await mediaDatabase();
  return (
    await pool.query(
      "SELECT id, url, filename, alt FROM vintage_homepage_media ORDER BY created_at DESC LIMIT 100",
    )
  ).rows;
}
