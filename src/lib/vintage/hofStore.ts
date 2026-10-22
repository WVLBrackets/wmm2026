import {
  DEFAULT_VINTAGE_HOF_CONTENT,
  normalizeVintageHofContent,
  type VintageHofContent,
  validateVintageHofContent,
} from "./hofContent";
import {
  isHofRevisionContent,
  splitHomepageDocument,
  unwrapHofRevisionContent,
  wrapHofRevisionContent,
} from "./homepageDocument";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { writeVintageSidecarContent } from "./sidecarWriter";
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

export function hasVintageHofDatabase(): boolean {
  return hasVintageDatabase();
}

/**
 * Read Hall of Fame copy draft/published from the homepage row sidecar.
 */
export async function readVintageHofState(): Promise<VintageHofState> {
  if (!hasVintageHofDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await getVintageDbPool().query(
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
  await writeVintageSidecarContent<VintageHofContent>({
    slot: "hof",
    input,
    author,
    isRevisionContent: isHofRevisionContent,
    unwrapRevision: unwrapHofRevisionContent,
    wrapRevision: wrapHofRevisionContent,
    wrongRevisionMessage: "That revision is not a Hall of Fame copy revision.",
    normalizeSidecar: normalizeVintageHofContent,
    validateSidecar: validateVintageHofContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintageHofContent(splitHomepageDocument(publishedRow).hof),
  });
  return readVintageHofState();
}
