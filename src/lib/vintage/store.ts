import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  type VintageContent,
  validateVintageContent,
} from "./content";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import {
  mergeHomepageDocument,
  splitHomepageDocument,
} from "./homepageDocument";
import { sidecarsFromRow } from "./sidecarPreserve";
import {
  rawHomepageHasKeyData,
} from "./seasonKeyData";

export interface VintageState {
  version: number;
  draft: VintageContent;
  published: VintageContent;
}
const EMPTY = (): VintageState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_CONTENT),
});
export { hasVintageDatabase };

/**
 * Normalize homepage JSON while ignoring CMS sidecars.
 */
function homepageFromRow(raw: unknown): VintageContent {
  return normalizeVintageContent(splitHomepageDocument(raw).homepage);
}

/**
 * When Key Data was never saved on the homepage row, seed season gates from
 * published My Picks so production values are not reset to defaults.
 */
async function inheritKeyDataFromPicksIfNeeded(
  content: VintageContent,
  rawRow: unknown,
): Promise<VintageContent> {
  const homepageFragment = splitHomepageDocument(rawRow).homepage;
  if (rawHomepageHasKeyData(homepageFragment)) return content;
  try {
    const { getPublishedVintagePicksContent } = await import("./picksStore");
    const picks = await getPublishedVintagePicksContent();
    return {
      ...content,
      keyData: {
        siteName: content.keyData.siteName,
        bracketsPublished: picks.bracketsPublished,
        entryCost: picks.entryCost,
        venmoUser: content.keyData.venmoUser,
        enablePayCapability: content.keyData.enablePayCapability,
        masterLockUnlocked: picks.masterLockUnlocked,
        masterLockMessage:
          picks.masterLockMessage?.trim() || content.keyData.masterLockMessage,
      },
    };
  } catch {
    return content;
  }
}

export async function readVintageState(): Promise<VintageState> {
  if (!hasVintageDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draft = await inheritKeyDataFromPicksIfNeeded(
    homepageFromRow(row.draft),
    row.draft,
  );
  const published = await inheritKeyDataFromPicksIfNeeded(
    homepageFromRow(row.published),
    row.published,
  );
  validateVintageContent(draft);
  validateVintageContent(published);
  return {
    version: Number(row.version),
    draft,
    published,
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
    action: "save" | "publish";
    version: number;
    content: VintageContent;
  },
  _author: string,
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
    const normalized = normalizeVintageContent(input.content);
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return readVintageState();
}
