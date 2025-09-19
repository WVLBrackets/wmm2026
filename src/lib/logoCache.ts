// Local logo caching system
// Uses pre-downloaded team logos for instant loading

// List of team IDs that have logos downloaded locally
const DOWNLOADED_TEAM_IDS = new Set([
  '26', '57', '96', '120', '130', '150', '158', '183', '200', '222',
  '228', '233', '235', '236', '238', '239', '241', '242', '245', '246',
  '247', '248', '249', '250', '251', '252', '253', '254', '255', '256',
  '257', '258', '259', '260', '261'
]);

/**
 * Get the local path for a cached logo
 */
function getLocalLogoPath(teamId: string, size: number): string {
  return `/logos/${teamId}_${size}.png`;
}

/**
 * Check if a logo is cached locally
 */
export function isLogoCached(teamId: string, size: number): boolean {
  return DOWNLOADED_TEAM_IDS.has(teamId);
}

/**
 * Get cached logo URL (local path)
 */
export function getCachedLogoUrl(teamId: string, size: number): string | null {
  if (!isLogoCached(teamId, size)) return null;
  return getLocalLogoPath(teamId, size);
}

/**
 * Preload logos for a list of team IDs
 * Since logos are already downloaded, this is a no-op
 */
export async function preloadLogos(teamIds: string[], sizes: number[] = [30, 75]): Promise<void> {
  // Logos are already downloaded locally, no need to do anything
  console.log(`🖼️ Using local logos for ${teamIds.length} teams`);
}

/**
 * Initialize logo cache
 * Since logos are already downloaded, this is a no-op
 */
export function initializeLogoCache(): void {
  console.log(`🖼️ Logo cache initialized with ${DOWNLOADED_TEAM_IDS.size} local logos`);
}
