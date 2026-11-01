import type { VintageContent } from "./content";

/** Sidecar key for handbook CMS on the shared vintage_homepage JSON row. */
export const INFO_HANDBOOK_KEY = "__infoHandbook";

/** Sidecar key for Hall of Fame display copy on the shared homepage JSON row. */
export const HOF_CONTENT_KEY = "__hofContent";

/** Sidecar key for My Picks landing copy on the shared homepage JSON row. */
export const PICKS_CONTENT_KEY = "__picksContent";

/** Sidecar key for Live Standings display copy on the shared homepage JSON row. */
export const STANDINGS_CONTENT_KEY = "__standingsContent";

/** Sidecar key for Emails & Account copy. */
export const EMAILS_CONTENT_KEY = "__emailsContent";

/** Sidecar key for Bracket Editor Messages. */
export const BRACKET_EDITOR_CONTENT_KEY = "__bracketEditorContent";

/** Sidecar key for Scoreboard page copy. */
export const SCOREBOARD_CONTENT_KEY = "__scoreboardContent";

/**
 * Document schema marker. Rows stamped with {@link CMS_SCHEMA_VERSION} store
 * every section in full, so public reads never fill copy from code.
 */
export const CMS_SCHEMA_KEY = "__cmsSchema";
export const CMS_SCHEMA_VERSION = 2;

/** Slot → JSON key for every CMS sidecar on the homepage row. */
export const SIDECAR_KEYS = {
  info: INFO_HANDBOOK_KEY,
  hof: HOF_CONTENT_KEY,
  picks: PICKS_CONTENT_KEY,
  standings: STANDINGS_CONTENT_KEY,
  emails: EMAILS_CONTENT_KEY,
  bracketEditor: BRACKET_EDITOR_CONTENT_KEY,
  scoreboard: SCOREBOARD_CONTENT_KEY,
} as const;

export type SidecarSlot = keyof typeof SIDECAR_KEYS;

export const SIDECAR_SLOTS = Object.keys(SIDECAR_KEYS) as SidecarSlot[];

export type SplitHomepageDocument = {
  homepage: unknown;
  schema: number;
} & Record<SidecarSlot, unknown>;

/**
 * Split homepage JSON from its CMS sidecars (app role cannot CREATE tables,
 * so every section lives on one row).
 *
 * @param raw - Stored `draft` or `published` JSON
 */
export function splitHomepageDocument(raw: unknown): SplitHomepageDocument {
  const empty = Object.fromEntries(
    SIDECAR_SLOTS.map((slot) => [slot, undefined]),
  ) as Record<SidecarSlot, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { homepage: raw, schema: 0, ...empty };
  }
  const homepage: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const sides = { ...empty };
  for (const slot of SIDECAR_SLOTS) {
    const key = SIDECAR_KEYS[slot];
    sides[slot] = homepage[key];
    delete homepage[key];
  }
  const schema = Number(homepage[CMS_SCHEMA_KEY]) || 0;
  delete homepage[CMS_SCHEMA_KEY];
  return { homepage, schema, ...sides };
}

/**
 * Reattach sidecars onto a homepage document and stamp the schema version.
 *
 * @param homepage - Normalized homepage content
 * @param sidecars - Sidecar values by slot (missing slots are omitted)
 */
export function mergeHomepageDocument(
  homepage: VintageContent,
  sidecars: Partial<Record<SidecarSlot, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...homepage };
  for (const slot of SIDECAR_SLOTS) {
    const value = sidecars[slot];
    if (value != null) out[SIDECAR_KEYS[slot]] = value;
  }
  out[CMS_SCHEMA_KEY] = CMS_SCHEMA_VERSION;
  return out;
}
