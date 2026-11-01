import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import type { SidecarSlot } from "./homepageDocument";
import {
  SIDECAR_CODECS,
  sidecarsFromRow,
  type VintageSidecarBag,
} from "./sidecarPreserve";
import { writeVintageSidecarContent, type SidecarWriteInput } from "./sidecarWriter";

/** Draft + published copy of one CMS section, for admin editors. */
export interface VintageSectionState<T> {
  version: number;
  draft: T;
  published: T;
}

/**
 * Read one section's draft/published for an admin editor. Missing sections
 * are seeded from editor defaults so admins always see a complete form.
 *
 * @param slot - Sidecar slot
 * @throws when the CMS database is not configured
 */
export async function readVintageSectionState<K extends SidecarSlot>(
  slot: K,
): Promise<VintageSectionState<VintageSidecarBag[K]>> {
  if (!hasVintageDatabase()) {
    throw new Error("Vintage CMS database is not configured.");
  }
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const row = result.rows[0];
  const codec = SIDECAR_CODECS[slot];
  const draft = sidecarsFromRow(row?.draft)[slot];
  const published = sidecarsFromRow(row?.published)[slot];
  codec.validate(draft);
  codec.validate(published);
  return { version: row ? Number(row.version) : 0, draft, published };
}

/**
 * Save or publish one section and return the refreshed editor state.
 *
 * @param slot - Sidecar slot
 * @param input - Action, optimistic version, content
 */
export async function writeVintageSection<K extends SidecarSlot>(
  slot: K,
  input: SidecarWriteInput<VintageSidecarBag[K]>,
): Promise<VintageSectionState<VintageSidecarBag[K]>> {
  await writeVintageSidecarContent(slot, input);
  return readVintageSectionState(slot);
}
