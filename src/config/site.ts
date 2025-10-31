/**
 * Warren's March Madness 2026 - Site Configuration
 * Unified configuration system with Google Sheets integration and fallbacks
 */

import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

// Cache for site config to avoid repeated API calls
let cachedConfig: SiteConfigData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get site configuration with caching and fallback
 * Tries Google Sheets first, falls back to environment variables
 */
export const getSiteConfig = async (): Promise<SiteConfigData> => {
  const now = Date.now();
  
  // Return cached config if it's still fresh
  if (cachedConfig && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedConfig;
  }
  
  try {
    // Try to get config from Google Sheets
    const googleConfig = await getSiteConfigFromGoogleSheets();
    if (googleConfig) {
      cachedConfig = googleConfig;
      lastFetchTime = now;
      return googleConfig;
    }
  } catch (error) {
    console.warn('Failed to fetch config from Google Sheets, using fallback:', error);
  }
  
  // Fallback to environment variables
  const fallbackConfig = getFallbackSiteConfig();
  cachedConfig = fallbackConfig;
  lastFetchTime = now;
  return fallbackConfig;
};

/**
 * Fallback configuration using centralized config
 * Used when Google Sheets is unavailable
 */
function getFallbackSiteConfig(): SiteConfigData {
  // Use centralized fallback config
  return FALLBACK_CONFIG;
}

// For backward compatibility, export a synchronous version that uses fallbacks
export const siteConfig = FALLBACK_CONFIG;

export default siteConfig;
