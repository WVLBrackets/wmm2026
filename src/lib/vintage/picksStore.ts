import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { splitHomepageDocument } from "./homepageDocument";
import {
  DEFAULT_VINTAGE_PICKS_CONTENT,
  normalizeVintagePicksContent,
  type VintagePicksContent,
  validateVintagePicksContent,
} from "./picksContent";
import { writeVintageSidecarContent } from "./sidecarWriter";

export interface VintagePicksState {
  version: number;
  draft: VintagePicksContent;
  published: VintagePicksContent;
}

const EMPTY = (): VintagePicksState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT),
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
  return {
    version: Number(row.version),
    draft: draftPicks,
    published: publishedPicks,
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
 * Save or publish My Picks copy on the shared homepage row.
 */
export async function writeVintagePicksContent(
  input: {
    action: "save" | "publish";
    version: number;
    content: VintagePicksContent;
  },
  _author: string,
): Promise<VintagePicksState> {
  await writeVintageSidecarContent<VintagePicksContent>({
    slot: "picks",
    input,
    normalizeSidecar: normalizeVintagePicksContent,
    validateSidecar: validateVintagePicksContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintagePicksContent(splitHomepageDocument(publishedRow).picks),
  });
  return readVintagePicksState();
}
