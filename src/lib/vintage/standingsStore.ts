import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  DEFAULT_VINTAGE_STANDINGS_CONTENT,
  normalizeVintageStandingsContent,
  type VintageStandingsContent,
  validateVintageStandingsContent,
} from "./standingsContent";
import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  validateVintageContent,
} from "./content";
import { isVintageEnabled } from "./access";
import { assertDedicatedVintageDatabase } from "./databaseSafety";
import {
  isStandingsRevisionContent,
  mergeHomepageDocument,
  splitHomepageDocument,
  unwrapStandingsRevisionContent,
  wrapStandingsRevisionContent,
} from "./homepageDocument";
import { sidecarsFromRow } from "./sidecarPreserve";
import type { VintageRevision } from "./store";

export interface VintageStandingsState {
  version: number;
  draft: VintageStandingsContent;
  published: VintageStandingsContent;
  revisions: VintageRevision[];
}

const EMPTY = (): VintageStandingsState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
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

export function hasVintageStandingsDatabase(): boolean {
  return !!process.env.VINTAGE_DATABASE_URL;
}

/**
 * Read Standings copy draft/published from the homepage row sidecar.
 */
export async function readVintageStandingsState(): Promise<VintageStandingsState> {
  if (!hasVintageStandingsDatabase()) return EMPTY();
  const result = await database().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await database().query(
    'SELECT id, created_at AS "createdAt", author, action, content FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 40',
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draftStandings = normalizeVintageStandingsContent(
    splitHomepageDocument(row.draft).standings,
  );
  const publishedStandings = normalizeVintageStandingsContent(
    splitHomepageDocument(row.published).standings,
  );
  validateVintageStandingsContent(draftStandings);
  validateVintageStandingsContent(publishedStandings);
  const standingsRevisions = revisions.rows
    .filter((item) => isStandingsRevisionContent(item.content))
    .slice(0, 20)
    .map(({ id, createdAt, author, action }) => ({
      id,
      createdAt,
      author,
      action,
    }));
  return {
    version: Number(row.version),
    draft: draftStandings,
    published: publishedStandings,
    revisions: standingsRevisions,
  };
}

/**
 * Published Standings copy for the primary-admin Live Standings page.
 */
export async function getPublishedVintageStandingsContent(): Promise<VintageStandingsContent> {
  try {
    return (await readVintageStandingsState()).published;
  } catch (error) {
    console.error(
      "[Vintage Standings] Published content unavailable:",
      error instanceof Error ? error.message : "storage error",
    );
    return structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT);
  }
}

/**
 * Save / publish / restore Standings copy on the shared homepage row.
 */
export async function writeVintageStandingsContent(
  input: {
    action: "save" | "publish" | "restore";
    version: number;
    content?: VintageStandingsContent;
    revisionId?: string;
  },
  author: string,
): Promise<VintageStandingsState> {
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

    let standingsContent = input.content;
    if (input.action === "restore") {
      const revision = await client.query(
        "SELECT content FROM vintage_homepage_revisions WHERE id = $1",
        [input.revisionId],
      );
      if (!revision.rows[0]) throw new Error("Revision not found.");
      if (!isStandingsRevisionContent(revision.rows[0].content)) {
        throw new Error("That revision is not a Standings copy revision.");
      }
      standingsContent = unwrapStandingsRevisionContent(
        revision.rows[0].content,
      ) as VintageStandingsContent;
    }

    const normalizedStandings = normalizeVintageStandingsContent(standingsContent);
    validateVintageStandingsContent(normalizedStandings);

    const draftHome = normalizeVintageContent(
      splitHomepageDocument(current.draft).homepage,
    );
    validateVintageContent(draftHome);
    const publishedHome = normalizeVintageContent(
      splitHomepageDocument(current.published).homepage,
    );
    validateVintageContent(publishedHome);

    const draftSides = sidecarsFromRow(current.draft);
    const publishedSides = sidecarsFromRow(current.published);
    const previousPublishedStandings = normalizeVintageStandingsContent(
      splitHomepageDocument(current.published).standings,
    );

    const draftOut = mergeHomepageDocument(
      draftHome,
      draftSides.info,
      draftSides.hof,
      draftSides.picks,
      normalizedStandings,
    );
    const publishedOut = mergeHomepageDocument(
      publishedHome,
      publishedSides.info,
      publishedSides.hof,
      publishedSides.picks,
      input.action === "publish"
        ? normalizedStandings
        : previousPublishedStandings,
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
        JSON.stringify(wrapStandingsRevisionContent(normalizedStandings)),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return readVintageStandingsState();
}
