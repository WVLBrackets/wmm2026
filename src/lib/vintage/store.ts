import "server-only";
import {
  normalizeVintageContent,
  type VintageContent,
  validateVintageContent,
} from "./content";
import { getPublishedCmsBundle } from "./cmsBundle";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { homepageFromRow } from "./sidecarPreserve";
import { rebuildHomepageRow, withLockedHomepageRow } from "./sidecarWriter";

export interface VintageState {
  version: number;
  draft: VintageContent;
  published: VintageContent;
}
export { hasVintageDatabase };

/**
 * Homepage draft/published for the admin editor.
 *
 * @throws when the CMS database is not configured
 */
export async function readVintageState(): Promise<VintageState> {
  if (!hasVintageDatabase()) {
    throw new Error("Vintage CMS database is not configured.");
  }
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const row = result.rows[0];
  const draft = homepageFromRow(row?.draft);
  const published = homepageFromRow(row?.published);
  validateVintageContent(draft);
  validateVintageContent(published);
  return { version: row ? Number(row.version) : 0, draft, published };
}

/** Published homepage (cached bundle; throws when CMS is unavailable). */
export async function getPublishedVintageContent(): Promise<VintageContent> {
  return (await getPublishedCmsBundle()).home;
}

/**
 * Save or publish homepage content (sidecars are preserved and completed).
 *
 * @param input - Action, optimistic version, content
 */
export async function writeVintageContent(
  input: {
    action: "save" | "publish";
    version: number;
    content: VintageContent;
  },
  _author: string,
): Promise<VintageState> {
  const normalized = normalizeVintageContent(input.content);
  validateVintageContent(normalized);
  await withLockedHomepageRow(input.version, (current) =>
    rebuildHomepageRow(current, (docs) => {
      docs.draft.home = normalized;
      if (input.action === "publish") docs.published.home = normalized;
    }),
  );
  return readVintageState();
}

/**
 * Rewrite draft + published with every section fully stored and stamped
 * schema v2 (idempotent). Required once per environment before strict reads.
 *
 * @returns The new row version
 */
export async function completeVintageCmsSections(): Promise<number> {
  if (!hasVintageDatabase()) {
    throw new Error("Vintage CMS database is not configured.");
  }
  await withLockedHomepageRow(null, (current) =>
    rebuildHomepageRow(current, () => undefined),
  );
  return (await readVintageState()).version;
}
