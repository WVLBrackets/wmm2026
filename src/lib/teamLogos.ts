// High-performance team logo mapping for ESPN team logos
// Optimized for frequent use across the site

import { getTeamIdByAbbr } from './teamRefData';
import { getCachedLogoUrl, preloadLogos } from './logoCache';

export interface TeamInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

// Cache for logo URLs to avoid repeated string concatenation
const logoUrlCache = new Map<string, string>();

// Pre-computed base URL parts for performance
const ESPN_BASE_URL = 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/';
const ESPN_EXTENSION = '.png';

// High-resolution base URL for better quality
const ESPN_HIGH_RES_BASE_URL = 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/';

/**
 * High-performance function to generate ESPN team logo URLs
 * Uses local cache when available, falls back to ESPN URLs
 * @param teamId - ESPN team ID
 * @param size - Logo size in pixels (default: 30)
 * @returns Local cached URL or ESPN combiner URL for the team logo
 */
export function getTeamLogoUrl(teamId: string, size: number = 30): string {
  // Check if we have a locally cached version
  const cachedUrl = getCachedLogoUrl(teamId, size);
  if (cachedUrl) {
    return cachedUrl;
  }
  
  // Create cache key for URL generation
  const cacheKey = `${teamId}-${size}`;
  
  // Return cached URL if available
  if (logoUrlCache.has(cacheKey)) {
    return logoUrlCache.get(cacheKey)!;
  }
  
  // Generate new URL with higher quality parameters
  // For small images, request a larger size and let the browser scale down for better quality
  const requestedSize = size <= 40 ? Math.max(size * 3, 96) : size;
  
  // Try different ESPN URL formats for better quality
  // Format 1: Standard combiner with quality parameter
  const logoUrl = `${ESPN_BASE_URL}${teamId}${ESPN_EXTENSION}&h=${requestedSize}&w=${requestedSize}&q=100&f=png`;
  
  // Debug logging
  console.log(`🔍 Generated logo URL for teamId "${teamId}", size ${size}:`, logoUrl);
  
  // Cache the result
  logoUrlCache.set(cacheKey, logoUrl);
  
  return logoUrl;
}

// Cache for team info to avoid repeated lookups
const teamInfoCache = new Map<string, TeamInfo>();

/**
 * High-performance function to get team information including logo URL
 * Caches results to avoid repeated team ID lookups
 * @param teamName - Team abbreviation or name
 * @param size - Logo size in pixels (default: 30)
 * @returns TeamInfo object with id, name, and logoUrl
 */
export async function getTeamInfo(teamName: string, size: number = 30): Promise<TeamInfo> {
  // Create cache key
  const cacheKey = `${teamName}-${size}`;
  
  // Return cached info if available
  if (teamInfoCache.has(cacheKey)) {
    return teamInfoCache.get(cacheKey)!;
  }
  
  try {
    const teamId = await getTeamIdByAbbr(teamName);
    
    console.log(`🔍 Looking up team "${teamName}" -> teamId: "${teamId}"`);
    
    if (!teamId) {
      console.warn(`Team logo not found for: "${teamName}". Please add to team reference data.`);
      // Return a placeholder that will show the team name as text
      const placeholderInfo: TeamInfo = {
        id: 'placeholder',
        name: teamName,
        logoUrl: null
      };
      teamInfoCache.set(cacheKey, placeholderInfo);
      return placeholderInfo;
    }
    
    const logoUrl = getTeamLogoUrl(teamId, size);
    
    const teamInfo: TeamInfo = {
      id: teamId,
      name: teamName,
      logoUrl: logoUrl
    };
    
    // Cache the result
    teamInfoCache.set(cacheKey, teamInfo);
    
    return teamInfo;
  } catch (error) {
    console.error(`Error getting team info for ${teamName}:`, error);
    // Return a placeholder that will show the team name as text
    const errorInfo: TeamInfo = {
      id: 'placeholder',
      name: teamName,
      logoUrl: null
    };
    teamInfoCache.set(cacheKey, errorInfo);
    return errorInfo;
  }
}

/**
 * Synchronous function to get logo URL when you already have the team ID
 * This is the fastest way to get a logo URL - no async operations needed
 * @param teamId - ESPN team ID
 * @param size - Logo size in pixels (default: 30)
 * @returns ESPN combiner URL for the team logo
 */
export function getLogoUrlSync(teamId: string, size: number = 30): string {
  return getTeamLogoUrl(teamId, size);
}

/**
 * Clear all caches - useful for testing or memory management
 */
export function clearLogoCaches(): void {
  logoUrlCache.clear();
  teamInfoCache.clear();
}

/**
 * Get cache statistics for monitoring performance
 */
export function getCacheStats(): { logoUrlCache: number; teamInfoCache: number } {
  return {
    logoUrlCache: logoUrlCache.size,
    teamInfoCache: teamInfoCache.size
  };
}

/**
 * Preload logos for teams used in standings data
 * This will cache logos locally for instant loading
 */
export async function preloadStandingsLogos(teamIds: string[]): Promise<void> {
  console.log(`🖼️ Preloading logos for ${teamIds.length} teams`);
  await preloadLogos(teamIds);
  console.log(`✅ Logo preload completed`);
}

export function parseTeamPicks(picksString: string): string[] {
  if (!picksString || picksString.trim() === '') {
    return [];
  }
  
  // Handle different formats - could be comma-separated or space-separated
  if (picksString.includes(',')) {
    return picksString.split(',').map(team => team.trim()).filter(team => team && team.length > 1);
  } else {
    // Split by spaces but handle multi-word team names
    // Filter out single characters and common separators
    return picksString.split(/\s+/).filter(team => 
      team && 
      team.length > 1 && 
      !team.match(/^[-\_\|]+$/) && // Filter out separators like -, _, |
      team !== 'vs' && 
      team !== 'and'
    );
  }
}
