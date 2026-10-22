import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import {
  isPicksRevisionContent,
  splitHomepageDocument,
  unwrapPicksRevisionContent,
  wrapPicksRevisionContent,
} from "./homepageDocument";
import {
  DEFAULT_VINTAGE_PICKS_CONTENT,
  normalizeVintagePicksContent,
  type VintagePicksContent,
  validateVintagePicksContent,
} from "./picksContent";
import { writeVintageSidecarContent } from "./sidecarWriter";
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

export function hasVintagePicksDatabase(): boolean {
  return hasVintageDatabase();
}

/**
 * Read My Picks copy draft/published from the homepage row sidecar.
 */
export async function readVintagePicksState(): Promise<VintagePicksState> {
  if (!hasVintagePicksDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await getVintageDbPool().query(
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
  await writeVintageSidecarContent<VintagePicksContent>({
    slot: "picks",
    input,
    author,
    isRevisionContent: isPicksRevisionContent,
    unwrapRevision: unwrapPicksRevisionContent,
    wrapRevision: wrapPicksRevisionContent,
    wrongRevisionMessage: "That revision is not a My Picks copy revision.",
    normalizeSidecar: normalizeVintagePicksContent,
    validateSidecar: validateVintagePicksContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintagePicksContent(splitHomepageDocument(publishedRow).picks),
  });
  return readVintagePicksState();
}
