import {
  DEFAULT_VINTAGE_INFO_CONTENT,
  normalizeVintageInfoContent,
  type VintageInfoContent,
  validateVintageInfoContent,
} from "./infoContent";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import {
  isInfoRevisionContent,
  splitHomepageDocument,
  unwrapInfoRevisionContent,
  wrapInfoRevisionContent,
} from "./homepageDocument";
import { writeVintageSidecarContent } from "./sidecarWriter";
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

export function hasVintageInfoDatabase(): boolean {
  return hasVintageDatabase();
}

/**
 * Read handbook draft/published from the homepage row sidecar + info revisions.
 */
export async function readVintageInfoState(): Promise<VintageInfoState> {
  if (!hasVintageInfoDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await getVintageDbPool().query(
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
  await writeVintageSidecarContent<VintageInfoContent>({
    slot: "info",
    input,
    author,
    isRevisionContent: isInfoRevisionContent,
    unwrapRevision: unwrapInfoRevisionContent,
    wrapRevision: wrapInfoRevisionContent,
    wrongRevisionMessage: "That revision is not a handbook revision.",
    normalizeSidecar: normalizeVintageInfoContent,
    validateSidecar: validateVintageInfoContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintageInfoContent(splitHomepageDocument(publishedRow).info),
  });
  return readVintageInfoState();
}
