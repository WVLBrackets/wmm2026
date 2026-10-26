import {
  DEFAULT_VINTAGE_INFO_CONTENT,
  normalizeVintageInfoContent,
  type VintageInfoContent,
  validateVintageInfoContent,
} from "./infoContent";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { splitHomepageDocument } from "./homepageDocument";
import { writeVintageSidecarContent } from "./sidecarWriter";

export interface VintageInfoState {
  version: number;
  draft: VintageInfoContent;
  published: VintageInfoContent;
}

const EMPTY = (): VintageInfoState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_INFO_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_INFO_CONTENT),
});

export function hasVintageInfoDatabase(): boolean {
  return hasVintageDatabase();
}

/**
 * Read handbook draft/published from the homepage row sidecar.
 */
export async function readVintageInfoState(): Promise<VintageInfoState> {
  if (!hasVintageInfoDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
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
  return {
    version: Number(row.version),
    draft: draftInfo,
    published: publishedInfo,
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
 * Save or publish handbook content on the shared homepage row.
 */
export async function writeVintageInfoContent(
  input: {
    action: "save" | "publish";
    version: number;
    content: VintageInfoContent;
  },
  _author: string,
): Promise<VintageInfoState> {
  await writeVintageSidecarContent<VintageInfoContent>({
    slot: "info",
    input,
    normalizeSidecar: normalizeVintageInfoContent,
    validateSidecar: validateVintageInfoContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintageInfoContent(splitHomepageDocument(publishedRow).info),
  });
  return readVintageInfoState();
}
