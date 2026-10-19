import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  DEFAULT_VINTAGE_PICKS_CONTENT,
  normalizeVintagePicksContent,
  type VintagePicksContent,
  validateVintagePicksContent,
} from "./picksContent";
import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  validateVintageContent,
} from "./content";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";
import {
  isPicksRevisionContent,
  mergeHomepageDocument,
  splitHomepageDocument,
  unwrapPicksRevisionContent,
  wrapPicksRevisionContent,
} from "./homepageDocument";
import { normalizeVintageInfoContent } from "./infoContent";
import { normalizeVintageHofContent } from "./hofContent";
import type { VintageRevision } from "./store";

export interface VintagePicksState {
  version: number;
  draft: VintagePicksContent;
  published: VintagePicksContent;
  revisions: VintageRevision[];
}

const EMPTY = (): VintagePicksState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT),
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

export function hasVintagePicksDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
}

/**
 * Read My Picks copy draft/published from the homepage row sidecar.
 */
export async function readVintagePicksState(): Promise<VintagePicksState> {
  if (!hasVintagePicksDatabase()) return EMPTY();
  const result = await database().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await database().query(
    'SELECT id, created_at AS "createdAt", author, action, content FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 40',
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draftPicks = normalizeVintagePicksContent(
    splitHomepageDocument(row.draft).picks,
  );
  const publishedPicks = normalizeVintagePicksContent(
    splitHomepageDocument(row.published).picks,
  );
  validateVintagePicksContent(draftPicks);
  validateVintagePicksContent(publishedPicks);
  const picksRevisions = revisions.rows
    .filter((item) => isPicksRevisionContent(item.content))
    .slice(0, 20)
    .map(({ id, createdAt, author, action }) => ({
      id,
      createdAt,
      author,
      action,
    }));
  return {
    version: Number(row.version),
    draft: draftPicks,
    published: publishedPicks,
    revisions: picksRevisions,
  };
}

/**
 * Published My Picks copy for the primary-admin landing.
 */
export async function getPublishedVintagePicksContent(): Promise<VintagePicksContent> {
  try {
    return (await readVintagePicksState()).published;
  } catch (error) {
    console.error(
      "[Vintage Picks] Published content unavailable:",
      error instanceof Error ? error.message : "storage error",
    );
    return structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT);
  }
}

/**
 * Save / publish / restore My Picks copy on the shared homepage row.
 */
export async function writeVintagePicksContent(
  input: {
    action: "save" | "publish" | "restore";
    version: number;
    content?: VintagePicksContent;
    revisionId?: string;
  },
  author: string,
): Promise<VintagePicksState> {
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

    let picksContent = input.content;
    if (input.action === "restore") {
      const revision = await client.query(
        "SELECT content FROM vintage_homepage_revisions WHERE id = $1",
        [input.revisionId],
      );
      if (!revision.rows[0]) throw new Error("Revision not found.");
      if (!isPicksRevisionContent(revision.rows[0].content)) {
        throw new Error("That revision is not a My Picks copy revision.");
      }
      picksContent = unwrapPicksRevisionContent(
        revision.rows[0].content,
      ) as VintagePicksContent;
    }

    const normalizedPicks = normalizeVintagePicksContent(picksContent);
    validateVintagePicksContent(normalizedPicks);

    const draftHome = normalizeVintageContent(
      splitHomepageDocument(current.draft).homepage,
    );
    validateVintageContent(draftHome);
    const publishedHome = normalizeVintageContent(
      splitHomepageDocument(current.published).homepage,
    );
    validateVintageContent(publishedHome);

    const draftInfoRaw = splitHomepageDocument(current.draft).info;
    const publishedInfoRaw = splitHomepageDocument(current.published).info;
    const draftInfo =
      draftInfoRaw != null
        ? normalizeVintageInfoContent(draftInfoRaw)
        : undefined;
    const publishedInfo =
      publishedInfoRaw != null
        ? normalizeVintageInfoContent(publishedInfoRaw)
        : undefined;

    const draftHofRaw = splitHomepageDocument(current.draft).hof;
    const publishedHofRaw = splitHomepageDocument(current.published).hof;
    const draftHof =
      draftHofRaw != null ? normalizeVintageHofContent(draftHofRaw) : undefined;
    const publishedHof =
      publishedHofRaw != null
        ? normalizeVintageHofContent(publishedHofRaw)
        : undefined;

    const previousPublishedPicks = normalizeVintagePicksContent(
      splitHomepageDocument(current.published).picks,
    );

    const draftOut = mergeHomepageDocument(
      draftHome,
      draftInfo,
      draftHof,
      normalizedPicks,
    );
    const publishedOut = mergeHomepageDocument(
      publishedHome,
      publishedInfo,
      publishedHof,
      input.action === "publish" ? normalizedPicks : previousPublishedPicks,
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
        JSON.stringify(wrapPicksRevisionContent(normalizedPicks)),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return readVintagePicksState();
}
