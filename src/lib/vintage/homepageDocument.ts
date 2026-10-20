import type { VintageContent } from "./content";
import type { VintageInfoContent } from "./infoContent";
import type { VintageHofContent } from "./hofContent";
import type { VintagePicksContent } from "./picksContent";
import type { VintageStandingsContent } from "./standingsContent";

/** Sidecar key for handbook CMS on the shared vintage_homepage JSON row. */
export const INFO_HANDBOOK_KEY = "__infoHandbook";

/** Sidecar key for Hall of Fame display copy on the shared homepage JSON row. */
export const HOF_CONTENT_KEY = "__hofContent";

/** Sidecar key for My Picks landing copy on the shared homepage JSON row. */
export const PICKS_CONTENT_KEY = "__picksContent";

/** Sidecar key for Live Standings display copy on the shared homepage JSON row. */
export const STANDINGS_CONTENT_KEY = "__standingsContent";

/**
 * Split homepage JSON from optional handbook + HoF + My Picks + Standings sidecars
 * (app role cannot CREATE tables).
 */
export function splitHomepageDocument(raw: unknown): {
  homepage: unknown;
  info: unknown;
  hof: unknown;
  picks: unknown;
  standings: unknown;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      homepage: raw,
      info: undefined,
      hof: undefined,
      picks: undefined,
      standings: undefined,
    };
  }
  const record = raw as Record<string, unknown>;
  const {
    [INFO_HANDBOOK_KEY]: info,
    [HOF_CONTENT_KEY]: hof,
    [PICKS_CONTENT_KEY]: picks,
    [STANDINGS_CONTENT_KEY]: standings,
    ...homepage
  } = record;
  return { homepage, info, hof, picks, standings };
}

/**
 * Reattach handbook / HoF / My Picks / Standings sidecars onto a homepage document.
 */
export function mergeHomepageDocument(
  homepage: VintageContent,
  info?: VintageInfoContent | null,
  hof?: VintageHofContent | null,
  picks?: VintagePicksContent | null,
  standings?: VintageStandingsContent | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...homepage };
  if (info) out[INFO_HANDBOOK_KEY] = info;
  if (hof) out[HOF_CONTENT_KEY] = hof;
  if (picks) out[PICKS_CONTENT_KEY] = picks;
  if (standings) out[STANDINGS_CONTENT_KEY] = standings;
  return out;
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
 * True when a revision payload belongs to the Hall of Fame copy editor.
 */
export function isHofRevisionContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "hof" && record.doc != null;
}

/**
 * True when a revision payload belongs to the My Picks copy editor.
 */
export function isPicksRevisionContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "picks" && record.doc != null;
}

/**
 * True when a revision payload belongs to the Standings copy editor.
 */
export function isStandingsRevisionContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === "standings" && record.doc != null;
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
 * Wrap Hall of Fame copy for vintage_homepage_revisions rows.
 */
export function wrapHofRevisionContent(doc: VintageHofContent): {
  kind: "hof";
  doc: VintageHofContent;
} {
  return { kind: "hof", doc };
}

/**
 * Wrap My Picks copy for vintage_homepage_revisions rows.
 */
export function wrapPicksRevisionContent(doc: VintagePicksContent): {
  kind: "picks";
  doc: VintagePicksContent;
} {
  return { kind: "picks", doc };
}

/**
 * Wrap Standings copy for vintage_homepage_revisions rows.
 */
export function wrapStandingsRevisionContent(doc: VintageStandingsContent): {
  kind: "standings";
  doc: VintageStandingsContent;
} {
  return { kind: "standings", doc };
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

/**
 * Unwrap Hall of Fame copy from a revision payload.
 */
export function unwrapHofRevisionContent(value: unknown): unknown {
  if (isHofRevisionContent(value)) {
    return (value as { doc: unknown }).doc;
  }
  return value;
}

/**
 * Unwrap My Picks copy from a revision payload.
 */
export function unwrapPicksRevisionContent(value: unknown): unknown {
  if (isPicksRevisionContent(value)) {
    return (value as { doc: unknown }).doc;
  }
  return value;
}

/**
 * Unwrap Standings copy from a revision payload.
 */
export function unwrapStandingsRevisionContent(value: unknown): unknown {
  if (isStandingsRevisionContent(value)) {
    return (value as { doc: unknown }).doc;
  }
  return value;
}
