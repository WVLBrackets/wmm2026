// High-performance team logo mapping for ESPN team logos
// Optimized for frequent use across the site

import { getTeamIdByAbbr, getTeamIdByName } from './teamRefData';

export interface TeamInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

// Cache for team info to avoid repeated lookups
const teamInfoCache = new Map<string, TeamInfo>();

/**
 * High-performance function to generate local team logo URLs
 * Uses local logo files for better performance and reliability
 * @param teamId - ESPN team ID
 * @returns Local logo URL
 */
export function getTeamLogoUrl(teamId: string): string {
  // Use local logo files for better performance and reliability
  return `/logos/teams/${teamId}.png`;
}

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
    // Try to get team ID by name first (for full team names like "Florida Gators")
    let teamId = await getTeamIdByName(teamName);
    
    // If not found by name, try by abbreviation
    if (!teamId) {
      teamId = await getTeamIdByAbbr(teamName);
    }
    
    console.log(`🔍 Looking up team "${teamName}" -> teamId: "${teamId}"`);
    
    if (!teamId) {
      // Team not found in database - throw error instead of using fallback
      const error = new Error(`Team "${teamName}" not found in database. Please add it to the team reference data.`);
      // Don't cache the error - allow retry if team is added later
      throw error;
    }
    
    const logoUrl = getTeamLogoUrl(teamId);
    
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
    // Re-throw the error - let the UI component handle it
    throw error;
  }
}

/**
 * Synchronous function to get logo URL when you already have the team ID
 * This is the fastest way to get a logo URL - no async operations needed
 * @param teamId - ESPN team ID
 * @returns Local logo URL
 */
export function getLogoUrlSync(teamId: string): string {
  return getTeamLogoUrl(teamId);
}

/**
 * Clear all caches - useful for testing or memory management
 */
export function clearLogoCaches(): void {
  teamInfoCache.clear();
}

/**
 * Get cache statistics for monitoring performance
 */
export function getCacheStats(): { teamInfoCache: number } {
  return {
    teamInfoCache: teamInfoCache.size
  };
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
