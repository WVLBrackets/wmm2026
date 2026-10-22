import { randomUUID } from "node:crypto";
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

export type CmsWriteAction = "save" | "publish" | "restore";

export interface SidecarWriteInput<T> {
  action: CmsWriteAction;
  version: number;
  content?: T;
  revisionId?: string;
}

export interface SidecarWriteConfig<T extends SidecarPayload> {
  slot: SidecarSlot;
  input: SidecarWriteInput<T>;
  author: string;
  isRevisionContent: (raw: unknown) => boolean;
  unwrapRevision: (raw: unknown) => unknown;
  wrapRevision: (content: T) => unknown;
  wrongRevisionMessage: string;
  normalizeSidecar: (content: T | undefined) => T;
  validateSidecar: (content: T) => void;
  readPublishedSidecar: (publishedRow: unknown) => T;
}

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
 */
export async function writeVintageSidecarContent<T extends SidecarPayload>(
  config: SidecarWriteConfig<T>,
): Promise<void> {
  const {
    slot,
    input,
    author,
    isRevisionContent,
    unwrapRevision,
    wrapRevision,
    wrongRevisionMessage,
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

    let sidecarInput = input.content;
    if (input.action === "restore") {
      const revision = await client.query(
        "SELECT content FROM vintage_homepage_revisions WHERE id = $1",
        [input.revisionId],
      );
      if (!revision.rows[0]) throw new Error("Revision not found.");
      if (!isRevisionContent(revision.rows[0].content)) {
        throw new Error(wrongRevisionMessage);
      }
      sidecarInput = unwrapRevision(revision.rows[0].content) as T | undefined;
    }

    const normalized = normalizeSidecar(sidecarInput);
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
    await client.query(
      "INSERT INTO vintage_homepage_revisions (id, author, action, content) VALUES ($1, $2, $3, $4)",
      [randomUUID(), author, input.action, JSON.stringify(wrapRevision(normalized))],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
