/**
 * In-memory cache for GET /api/team-data (one Node instance).
 * Must be invalidated when admin mutates team reference data so display-name clears propagate immediately.
 */

export type PublicTeamDataRow = {
  abbr: string;
  id: string;
  name: string;
  displayName: string;
  /** DB `display_name` when set; `null` = use `name` for UI/bracket enrichment. */
  customDisplayName: string | null;
};

const CACHE_MS = 2 * 60 * 1000;

let cached: { data: PublicTeamDataRow[]; timestamp: number } | null = null;

export function getCachedPublicTeamData(now: number): PublicTeamDataRow[] | null {
  if (cached && now - cached.timestamp < CACHE_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedPublicTeamData(data: PublicTeamDataRow[], timestamp: number): void {
  cached = { data, timestamp };
}

/**
 * Call after any admin write to `team_reference_data` so public clients see updates immediately.
 */
export function invalidateTeamDataPublicCache(): void {
  cached = null;
}

export { CACHE_MS as TEAM_DATA_PUBLIC_CACHE_MS };
