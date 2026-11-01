/**
 * Resolve stored region key (position or name) to the tournament region name.
 * Scoreboard historically stored page-relative positions ("Top Left"); public UI wants names ("Midwest").
 */
export function resolveRegionDisplayName(
  regionKey: string | null | undefined,
  regionNameByKey: Map<string, string> = new Map(),
): string | null {
  if (!regionKey) return null;
  const mapped =
    regionNameByKey.get(regionKey) ||
    regionNameByKey.get(regionKey.toLowerCase());
  if (mapped) return mapped;
  // Drop leftover bracket positions when no map is available.
  if (/^(top|bottom)\s+(left|right)$/i.test(regionKey.trim())) return null;
  return regionKey;
}

/**
 * Build position/name → display name map from tournament JSON.
 */
export function buildRegionNameMap(
  regions: Array<{ name: string; position: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const region of regions) {
    if (region.name) {
      map.set(region.name, region.name);
      map.set(region.name.toLowerCase(), region.name);
    }
    if (region.position) {
      map.set(region.position, region.name || region.position);
      map.set(region.position.toLowerCase(), region.name || region.position);
    }
  }
  return map;
}
