import { normalizeVintageHofContent, type VintageHofContent } from "./hofContent";
import { splitHomepageDocument } from "./homepageDocument";
import { normalizeVintageInfoContent, type VintageInfoContent } from "./infoContent";
import {
  normalizeVintagePicksContent,
  type VintagePicksContent,
} from "./picksContent";
import {
  normalizeVintageStandingsContent,
  type VintageStandingsContent,
} from "./standingsContent";

/** Normalized sidecar bag preserved across vintage_homepage writes. */
export interface VintageSidecarBag {
  info?: VintageInfoContent;
  hof?: VintageHofContent;
  picks?: VintagePicksContent;
  standings?: VintageStandingsContent;
}

/**
 * Read and normalize all CMS sidecars from a homepage JSON row.
 */
export function sidecarsFromRow(raw: unknown): VintageSidecarBag {
  const { info, hof, picks, standings } = splitHomepageDocument(raw);
  return {
    info: info != null ? normalizeVintageInfoContent(info) : undefined,
    hof: hof != null ? normalizeVintageHofContent(hof) : undefined,
    picks: picks != null ? normalizeVintagePicksContent(picks) : undefined,
    standings:
      standings != null
        ? normalizeVintageStandingsContent(standings)
        : undefined,
  };
}
