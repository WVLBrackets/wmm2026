import {
  DEFAULT_VINTAGE_CONTENT,
  normalizeVintageContent,
  validateVintageContent,
} from "./content";
import { getVintageDbPool } from "./dbPool";
import { mergeHomepageDocument, splitHomepageDocument } from "./homepageDocument";
import type { VintageHofContent } from "./hofContent";
import type { VintageInfoContent } from "./infoContent";
import type { VintagePicksContent } from "./picksContent";
import { sidecarsFromRow, type VintageSidecarBag } from "./sidecarPreserve";
import type { VintageStandingsContent } from "./standingsContent";

type SidecarPayload =
  | VintageInfoContent
  | VintageHofContent
  | VintagePicksContent
  | VintageStandingsContent;

export type SidecarSlot = "info" | "hof" | "picks" | "standings";

export type CmsWriteAction = "save" | "publish";

export interface SidecarWriteInput<T> {
  action: CmsWriteAction;
  version: number;
  content: T;
}

export interface SidecarWriteConfig<T extends SidecarPayload> {
  slot: SidecarSlot;
  input: SidecarWriteInput<T>;
  normalizeSidecar: (content: T | undefined) => T;
  validateSidecar: (content: T) => void;
  readPublishedSidecar: (publishedRow: unknown) => T;
}

/**
 * Merge homepage + other sidecars, replacing one sidecar slot.
 */
function mergeWithSidecar(
  homepage: ReturnType<typeof normalizeVintageContent>,
  sides: VintageSidecarBag,
  slot: SidecarSlot,
  sidecarValue: SidecarPayload,
) {
  const info =
    slot === "info" ? (sidecarValue as VintageInfoContent) : sides.info;
  const hof = slot === "hof" ? (sidecarValue as VintageHofContent) : sides.hof;
  const picks =
    slot === "picks" ? (sidecarValue as VintagePicksContent) : sides.picks;
  const standings =
    slot === "standings"
      ? (sidecarValue as VintageStandingsContent)
      : sides.standings;
  return mergeHomepageDocument(homepage, info, hof, picks, standings);
}

/**
 * Transactional write for handbook / HoF / Picks / Standings sidecars on `vintage_homepage`.
 * Draft and published rows are updated in place; no revision history is retained.
 */
export async function writeVintageSidecarContent<T extends SidecarPayload>(
  config: SidecarWriteConfig<T>,
): Promise<void> {
  const {
    slot,
    input,
    normalizeSidecar,
    validateSidecar,
    readPublishedSidecar,
  } = config;

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

    const normalized = normalizeSidecar(input.content);
    validateSidecar(normalized);

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
    const previousPublished = readPublishedSidecar(current.published);
    const publishedSidecar =
      input.action === "publish" ? normalized : previousPublished;

    const draftOut = mergeWithSidecar(
      draftHome,
      draftSides,
      slot,
      normalized,
    );
    const publishedOut = mergeWithSidecar(
      publishedHome,
      publishedSides,
      slot,
      publishedSidecar,
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
}
