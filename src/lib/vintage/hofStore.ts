import {
  DEFAULT_VINTAGE_HOF_CONTENT,
  normalizeVintageHofContent,
  type VintageHofContent,
  validateVintageHofContent,
} from "./hofContent";
import { splitHomepageDocument } from "./homepageDocument";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { writeVintageSidecarContent } from "./sidecarWriter";

export interface VintageHofState {
  version: number;
  draft: VintageHofContent;
  published: VintageHofContent;
}

const EMPTY = (): VintageHofState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_HOF_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_HOF_CONTENT),
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
  return {
    version: Number(row.version),
    draft: draftHof,
    published: publishedHof,
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
 * Save or publish Hall of Fame copy on the shared homepage row.
 */
export async function writeVintageHofContent(
  input: {
    action: "save" | "publish";
    version: number;
    content: VintageHofContent;
  },
  _author: string,
): Promise<VintageHofState> {
  await writeVintageSidecarContent<VintageHofContent>({
    slot: "hof",
    input,
    normalizeSidecar: normalizeVintageHofContent,
    validateSidecar: validateVintageHofContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintageHofContent(splitHomepageDocument(publishedRow).hof),
  });
  return readVintageHofState();
}
