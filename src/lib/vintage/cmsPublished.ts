import { blankMissingStrings } from "./copyTree";
import {
  normalizeVintageContent,
  validateVintageContent,
  type VintageContent,
} from "./content";
import {
  CMS_SCHEMA_VERSION,
  SIDECAR_SLOTS,
  splitHomepageDocument,
  type SidecarSlot,
} from "./homepageDocument";
import { SIDECAR_CODECS, type VintageSidecarBag } from "./sidecarPreserve";

/** Thrown when published CMS content cannot be served (missing, unmigrated, invalid). */
export class CmsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsUnavailableError";
  }
}

/** Every published CMS section from one `vintage_homepage` read. */
export interface VintageCmsBundle extends VintageSidecarBag {
  version: number;
  home: VintageContent;
}

/**
 * Parse a published row into a strict bundle: copy that was never stored is
 * blank (hidden), never filled from code defaults.
 *
 * @param version - Row version
 * @param published - Stored `published` JSON
 * @throws CmsUnavailableError when the row predates schema v2 or fails validation
 */
export function parsePublishedCmsBundle(
  version: number,
  published: unknown,
): VintageCmsBundle {
  const split = splitHomepageDocument(published);
  if (split.schema < CMS_SCHEMA_VERSION) {
    throw new CmsUnavailableError(
      "Published CMS content has not been migrated to schema v2. Sign in as admin, then open /api/admin/vintage-cms-complete (or Vintage Admin → Home → Complete CMS sections).",
    );
  }
  const home = blankMissingStrings(
    normalizeVintageContent(split.homepage),
    split.homepage,
  );
  try {
    validateVintageContent(home);
  } catch (error) {
    throw new CmsUnavailableError(
      `Published homepage CMS is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const sides = {} as Record<SidecarSlot, unknown>;
  for (const slot of SIDECAR_SLOTS) {
    const raw = split[slot];
    if (raw == null) {
      throw new CmsUnavailableError(`Published CMS is missing the “${slot}” section.`);
    }
    sides[slot] = blankMissingStrings(SIDECAR_CODECS[slot].normalize(raw), raw);
  }
  return {
    version,
    home,
    ...(sides as unknown as VintageSidecarBag),
  };
}
