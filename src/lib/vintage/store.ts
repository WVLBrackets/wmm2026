import { randomUUID } from "node:crypto";
import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  type VintageContent,
  validateVintageContent,
} from "./content";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import {
  isHofRevisionContent,
  isInfoRevisionContent,
  isPicksRevisionContent,
  isStandingsRevisionContent,
  mergeHomepageDocument,
  splitHomepageDocument,
} from "./homepageDocument";
import { sidecarsFromRow } from "./sidecarPreserve";

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
export { hasVintageDatabase };

/**
 * Normalize homepage JSON while ignoring CMS sidecars.
 */
function homepageFromRow(raw: unknown): VintageContent {
  return normalizeVintageContent(splitHomepageDocument(raw).homepage);
}

export async function readVintageState(): Promise<VintageState> {
  if (!hasVintageDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await getVintageDbPool().query(
    "SELECT id, created_at AS \"createdAt\", author, action, content FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 40",
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draft = homepageFromRow(row.draft);
  const published = homepageFromRow(row.published);
  validateVintageContent(draft);
  validateVintageContent(published);
  const homepageRevisions = revisions.rows
    .filter(
      (item) =>
        !isInfoRevisionContent(item.content) &&
        !isHofRevisionContent(item.content) &&
        !isPicksRevisionContent(item.content) &&
        !isStandingsRevisionContent(item.content),
    )
    .slice(0, 20)
    .map(({ id, createdAt, author, action }) => ({
      id,
      createdAt,
      author,
      action,
    }));
  return {
    version: Number(row.version),
    draft,
    published,
    revisions: homepageRevisions,
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
  const client = await getVintageDbPool().connect();
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
      if (isInfoRevisionContent(revision.rows[0].content)) {
        throw new Error(
          "That revision belongs to the handbook editor. Restore it there.",
        );
      }
      if (isHofRevisionContent(revision.rows[0].content)) {
        throw new Error(
          "That revision belongs to the Hall of Fame editor. Restore it there.",
        );
      }
      if (isPicksRevisionContent(revision.rows[0].content)) {
        throw new Error(
          "That revision belongs to the My Picks editor. Restore it there.",
        );
      }
      if (isStandingsRevisionContent(revision.rows[0].content)) {
        throw new Error(
          "That revision belongs to the Standings editor. Restore it there.",
        );
      }
      content = splitHomepageDocument(revision.rows[0].content).homepage as
        | VintageContent
        | undefined;
    }
    const normalized = normalizeVintageContent(content);
    validateVintageContent(normalized);
    const draftSides = sidecarsFromRow(current.draft);
    const publishedSides = sidecarsFromRow(current.published);
    const publishedHome =
      input.action === "publish"
        ? normalized
        : homepageFromRow(current.published);
    const draftOut = mergeHomepageDocument(
      normalized,
      draftSides.info,
      draftSides.hof,
      draftSides.picks,
      draftSides.standings,
    );
    const publishedOut = mergeHomepageDocument(
      publishedHome,
      publishedSides.info,
      publishedSides.hof,
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
        JSON.stringify(
          mergeHomepageDocument(
            normalized,
            draftSides.info,
            draftSides.hof,
            draftSides.picks,
            draftSides.standings,
          ),
        ),
      ],
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
