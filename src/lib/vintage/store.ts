import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  DEFAULT_VINTAGE_CONTENT,
  type VintageContent,
  validateVintageContent,
} from "./content";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";
export interface VintageRevision {
  id: string;
  createdAt: string;
  author: string;
  action: string;
}
export interface VintageState {
  version: number;
  draft: VintageContent;
  published: VintageContent;
  revisions: VintageRevision[];
}
const EMPTY = (): VintageState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_CONTENT),
  revisions: [],
});
let pool: Pool | undefined;
/** A dedicated connection is required. Never fall back to the bracket database. */
function database(): Pool {
  if (!isVintageEnabled()) throw new Error("Vintage is disabled.");
  const connectionString = process.env.VINTAGE_DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "Set VINTAGE_DATABASE_URL to a dedicated vintage database.",
    );
  assertDedicatedVintageDatabase(connectionString);
  pool ??= new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
  return pool;
}
export function hasVintageDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
}
export async function readVintageState(): Promise<VintageState> {
  if (!hasVintageDatabase()) return EMPTY();
  const result = await database().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await database().query(
    'SELECT id, created_at AS "createdAt", author, action FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 20',
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  validateVintageContent(row.draft);
  validateVintageContent(row.published);
  return {
    version: Number(row.version),
    draft: row.draft,
    published: row.published,
    revisions: revisions.rows,
  };
}
export async function getPublishedVintageContent(): Promise<VintageContent> {
  try {
    return (await readVintageState()).published;
  } catch (error) {
    console.error(
      "[Vintage] Published content unavailable:",
      error instanceof Error ? error.message : "storage error",
    );
    return structuredClone(DEFAULT_VINTAGE_CONTENT);
  }
}
export async function writeVintageContent(
  input: {
    action: "save" | "publish" | "restore";
    version: number;
    content?: VintageContent;
    revisionId?: string;
  },
  author: string,
): Promise<VintageState> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO vintage_homepage (id, version, draft, published) VALUES (1, 0, $1, $1) ON CONFLICT DO NOTHING",
      [JSON.stringify(DEFAULT_VINTAGE_CONTENT)],
    );
    const result = await client.query(
      "SELECT version, draft, published FROM vintage_homepage WHERE id = 1 FOR UPDATE",
    );
    const current = result.rows[0];
    if (Number(current.version) !== input.version) throw new Error("CONFLICT");
    let content = input.content;
    if (input.action === "restore") {
      const revision = await client.query(
        "SELECT content FROM vintage_homepage_revisions WHERE id = $1",
        [input.revisionId],
      );
      if (!revision.rows[0]) throw new Error("Revision not found.");
      content = revision.rows[0].content;
    }
    validateVintageContent(content);
    const published = input.action === "publish" ? content : current.published;
    await client.query(
      "UPDATE vintage_homepage SET version = version + 1, draft = $1, published = $2 WHERE id = 1",
      [JSON.stringify(content), JSON.stringify(published)],
    );
    await client.query(
      "INSERT INTO vintage_homepage_revisions (id, author, action, content) VALUES ($1, $2, $3, $4)",
      [randomUUID(), author, input.action, JSON.stringify(content)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return readVintageState();
}
