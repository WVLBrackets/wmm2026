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
 * Works in both server and client contexts
 */
export const getSiteConfig = async (): Promise<SiteConfigData> => {
  const now = Date.now();
  
  // Return cached config if it's still fresh
  if (cachedConfig && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedConfig;
  }
  
  try {
    // Check if we're in a server environment (Node.js) or browser
    const isServer = typeof window === 'undefined';
    
    let googleConfig: SiteConfigData | null = null;
    
    if (isServer) {
      // Server-side: Call getSiteConfigFromGoogleSheets directly
      googleConfig = await getSiteConfigFromGoogleSheets();
    } else {
      // Client-side: Use API route to avoid unstable_cache issues
      const response = await fetch('/api/site-config');
      const result = await response.json();
      if (result.success) {
        googleConfig = result.data;
      }
    }
    
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
