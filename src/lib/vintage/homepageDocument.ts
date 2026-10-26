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
