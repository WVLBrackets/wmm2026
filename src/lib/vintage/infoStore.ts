import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  DEFAULT_VINTAGE_INFO_CONTENT,
  normalizeVintageInfoContent,
  type VintageInfoContent,
  validateVintageInfoContent,
} from "./infoContent";
import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  validateVintageContent,
} from "./content";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";
import {
  isInfoRevisionContent,
  mergeHomepageDocument,
  splitHomepageDocument,
  unwrapInfoRevisionContent,
  wrapInfoRevisionContent,
} from "./homepageDocument";
import type { VintageRevision } from "./store";

export interface VintageInfoState {
  version: number;
  draft: VintageInfoContent;
  published: VintageInfoContent;
  revisions: VintageRevision[];
}

const EMPTY = (): VintageInfoState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_INFO_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_INFO_CONTENT),
  revisions: [],
});

let pool: Pool | undefined;

/**
 * Dedicated vintage DB pool (same DB as the homepage store).
 */
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

export function hasVintageInfoDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
}

/**
 * Read handbook draft/published from the homepage row sidecar + info revisions.
 */
export async function readVintageInfoState(): Promise<VintageInfoState> {
  if (!hasVintageInfoDatabase()) return EMPTY();
  const result = await database().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await database().query(
    'SELECT id, created_at AS "createdAt", author, action, content FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 40',
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draftInfo = normalizeVintageInfoContent(
    splitHomepageDocument(row.draft).info,
  );
  const publishedInfo = normalizeVintageInfoContent(
    splitHomepageDocument(row.published).info,
  );
  validateVintageInfoContent(draftInfo);
  validateVintageInfoContent(publishedInfo);
  const infoRevisions = revisions.rows
    .filter((item) => isInfoRevisionContent(item.content))
    .slice(0, 20)
    .map(({ id, createdAt, author, action }) => ({
      id,
      createdAt,
      author,
      action,
    }));
  return {
    version: Number(row.version),
    draft: draftInfo,
    published: publishedInfo,
    revisions: infoRevisions,
  };
}

/**
 * Published handbook for the primary-admin Info page.
 */
export async function getPublishedVintageInfoContent(): Promise<VintageInfoContent> {
  try {
    return (await readVintageInfoState()).published;
  } catch (error) {
    console.error(
      "[Vintage Info] Published content unavailable:",
      error instanceof Error ? error.message : "storage error",
    );
    return structuredClone(DEFAULT_VINTAGE_INFO_CONTENT);
  }
}

/**
 * Save / publish / restore handbook content on the shared homepage row.
 */
export async function writeVintageInfoContent(
  input: {
    action: "save" | "publish" | "restore";
    version: number;
    content?: VintageInfoContent;
    revisionId?: string;
  },
  author: string,
): Promise<VintageInfoState> {
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

    let infoContent = input.content;
    if (input.action === "restore") {
      const revision = await client.query(
        "SELECT content FROM vintage_homepage_revisions WHERE id = $1",
        [input.revisionId],
      );
      if (!revision.rows[0]) throw new Error("Revision not found.");
      if (!isInfoRevisionContent(revision.rows[0].content)) {
        throw new Error("That revision is not a handbook revision.");
      }
      infoContent = unwrapInfoRevisionContent(
        revision.rows[0].content,
      ) as VintageInfoContent;
    }

    const normalizedInfo = normalizeVintageInfoContent(infoContent);
    validateVintageInfoContent(normalizedInfo);

    const draftHome = normalizeVintageContent(
      splitHomepageDocument(current.draft).homepage,
    );
    validateVintageContent(draftHome);
    const publishedHome = normalizeVintageContent(
      splitHomepageDocument(current.published).homepage,
    );
    validateVintageContent(publishedHome);

    const previousPublishedInfo = normalizeVintageInfoContent(
      splitHomepageDocument(current.published).info,
    );

    const draftOut = mergeHomepageDocument(draftHome, normalizedInfo);
    const publishedOut = mergeHomepageDocument(
      publishedHome,
      input.action === "publish" ? normalizedInfo : previousPublishedInfo,
    );

    await client.query(
      "UPDATE vintage_homepage SET version = version + 1, draft = $1, published = $2 WHERE id = 1",
      [JSON.stringify(draftOut), JSON.stringify(publishedOut)],
    );
    await client.query(
      "INSERT INTO vintage_homepage_revisions (id, author, action, content) VALUES ($1, $2, $3, $4)",
      [
        randomUUID(),
        author,
        input.action,
        JSON.stringify(wrapInfoRevisionContent(normalizedInfo)),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return readVintageInfoState();
}
