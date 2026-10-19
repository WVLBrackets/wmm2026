import type { VintageContent } from "./content";
import type { VintageInfoContent } from "./infoContent";

/** Sidecar key for handbook CMS on the shared vintage_homepage JSON row. */
export const INFO_HANDBOOK_KEY = "__infoHandbook";

/**
 * Split homepage JSON from the optional handbook sidecar (app role cannot CREATE tables).
 */
export function splitHomepageDocument(raw: unknown): {
  homepage: unknown;
  info: unknown;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { homepage: raw, info: undefined };
  }
  const record = raw as Record<string, unknown>;
  const { [INFO_HANDBOOK_KEY]: info, ...homepage } = record;
  return { homepage, info };
}

/**
 * Reattach handbook sidecar onto a homepage document for storage.
 */
export function mergeHomepageDocument(
  homepage: VintageContent,
  info: VintageInfoContent | undefined | null,
): Record<string, unknown> {
  if (!info) return { ...homepage };
  return { ...homepage, [INFO_HANDBOOK_KEY]: info };
}

/**
 * True when a revision payload belongs to the handbook editor.
 */
export function isInfoRevisionContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "info" && record.doc != null;
}

/**
 * Wrap handbook content for vintage_homepage_revisions rows.
 */
export function wrapInfoRevisionContent(doc: VintageInfoContent): {
  kind: "info";
  doc: VintageInfoContent;
} {
  return { kind: "info", doc };
}

/**
 * Unwrap handbook content from a revision payload.
 */
export function unwrapInfoRevisionContent(value: unknown): unknown {
  if (isInfoRevisionContent(value)) {
    return (value as { doc: unknown }).doc;
  }
  return value;
}
