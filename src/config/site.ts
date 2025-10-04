/**
 * Warren's March Madness 2026 - Site Configuration
 * Unified configuration system with Google Sheets integration and fallbacks
 */

import { getSiteConfigFromGoogleSheets, SiteConfigData } from '@/lib/siteConfig';

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
 * Fallback configuration using environment variables
 * Used when Google Sheets is unavailable
 */
function getFallbackSiteConfig(): SiteConfigData {
  return {
    tournamentYear: process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || '2026',
    lastYearWinner: process.env.NEXT_PUBLIC_LAST_YEAR_WINNER || 'Randy Phillips (Randy Line Sports)',
    lastYearChampionship: parseInt(process.env.NEXT_PUBLIC_LAST_YEAR_CHAMPIONSHIP || '2025'),
    tournamentStartDate: process.env.NEXT_PUBLIC_TOURNAMENT_START_DATE || '2026-03-18T12:00:00-05:00',
    tournamentStartTime: process.env.NEXT_PUBLIC_TOURNAMENT_START_TIME || '12:00 PM EST',
    numberOfPlayers: parseInt(process.env.NEXT_PUBLIC_NUMBER_OF_PLAYERS || '0'),
    totalPrizeAmount: parseInt(process.env.NEXT_PUBLIC_TOTAL_PRIZE_AMOUNT || '0'),
    siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Warren's March Madness",
    siteDescription: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Annual March Madness Bracket Challenge',
    oldSiteUrl: 'https://warrensmadness.webnode.page/',
    standingsTabs: parseInt(process.env.NEXT_PUBLIC_STANDINGS_TABS || '2'),
    standingsYear: process.env.NEXT_PUBLIC_STANDINGS_YEAR || '2026',
    footerText: process.env.NEXT_PUBLIC_FOOTER_TEXT || '© 2001 Warren\'s March Madness | All rights reserved',
    contactMe: process.env.NEXT_PUBLIC_CONTACT_ME || 'warren@example.com',
    prizesActiveForecast: process.env.NEXT_PUBLIC_PRIZES_ACTIVE_FORECAST || 'Forecast',
  };
}

// For backward compatibility, export a synchronous version that uses fallbacks
export const siteConfig = getFallbackSiteConfig();

export default siteConfig;
