import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  DEFAULT_VINTAGE_HOF_CONTENT,
  normalizeVintageHofContent,
  type VintageHofContent,
  validateVintageHofContent,
} from "./hofContent";
import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  validateVintageContent,
} from "./content";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";
import {
  isHofRevisionContent,
  mergeHomepageDocument,
  splitHomepageDocument,
  unwrapHofRevisionContent,
  wrapHofRevisionContent,
} from "./homepageDocument";
import type { VintageRevision } from "./store";

export interface VintageHofState {
  version: number;
  draft: VintageHofContent;
  published: VintageHofContent;
  revisions: VintageRevision[];
}

const EMPTY = (): VintageHofState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_HOF_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_HOF_CONTENT),
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

export function hasVintageHofDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
}

/**
 * Read Hall of Fame copy draft/published from the homepage row sidecar.
 */
export async function readVintageHofState(): Promise<VintageHofState> {
  if (!hasVintageHofDatabase()) return EMPTY();
  const result = await database().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await database().query(
    'SELECT id, created_at AS "createdAt", author, action, content FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 40',
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draftHof = normalizeVintageHofContent(
    splitHomepageDocument(row.draft).hof,
  );
  const publishedHof = normalizeVintageHofContent(
    splitHomepageDocument(row.published).hof,
  );
  validateVintageHofContent(draftHof);
  validateVintageHofContent(publishedHof);
  const hofRevisions = revisions.rows
    .filter((item) => isHofRevisionContent(item.content))
    .slice(0, 20)
    .map(({ id, createdAt, author, action }) => ({
      id,
      createdAt,
      author,
      action,
    }));
  return {
    version: Number(row.version),
    draft: draftHof,
    published: publishedHof,
    revisions: hofRevisions,
  };
}

/**
 * Published Hall of Fame copy for the primary-admin HoF page.
 */
export async function getPublishedVintageHofContent(): Promise<VintageHofContent> {
  try {
    return (await readVintageHofState()).published;
  } catch (error) {
    console.error(
      "[Vintage HoF] Published content unavailable:",
      error instanceof Error ? error.message : "storage error",
    );
    return structuredClone(DEFAULT_VINTAGE_HOF_CONTENT);
  }
}

/**
 * Save / publish / restore Hall of Fame copy on the shared homepage row.
 */
export async function writeVintageHofContent(
  input: {
    action: "save" | "publish" | "restore";
    version: number;
    content?: VintageHofContent;
    revisionId?: string;
  },
  author: string,
): Promise<VintageHofState> {
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

    let hofContent = input.content;
    if (input.action === "restore") {
      const revision = await client.query(
        "SELECT content FROM vintage_homepage_revisions WHERE id = $1",
        [input.revisionId],
      );
      if (!revision.rows[0]) throw new Error("Revision not found.");
      if (!isHofRevisionContent(revision.rows[0].content)) {
        throw new Error("That revision is not a Hall of Fame copy revision.");
      }
      hofContent = unwrapHofRevisionContent(
        revision.rows[0].content,
      ) as VintageHofContent;
    }

    const normalizedHof = normalizeVintageHofContent(hofContent);
    validateVintageHofContent(normalizedHof);

    const draftHome = normalizeVintageContent(
      splitHomepageDocument(current.draft).homepage,
    );
    validateVintageContent(draftHome);
    const publishedHome = normalizeVintageContent(
      splitHomepageDocument(current.published).homepage,
    );
    validateVintageContent(publishedHome);

    const { sidecarsFromRow } = await import("./sidecarPreserve");
    const draftSides = sidecarsFromRow(current.draft);
    const publishedSides = sidecarsFromRow(current.published);

    const previousPublishedHof = normalizeVintageHofContent(
      splitHomepageDocument(current.published).hof,
    );

    const draftOut = mergeHomepageDocument(
      draftHome,
      draftSides.info,
      normalizedHof,
      draftSides.picks,
      draftSides.standings,
    );
    const publishedOut = mergeHomepageDocument(
      publishedHome,
      publishedSides.info,
      input.action === "publish" ? normalizedHof : previousPublishedHof,
      publishedSides.picks,
      publishedSides.standings,
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
        JSON.stringify(wrapHofRevisionContent(normalizedHof)),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return readVintageHofState();
}
