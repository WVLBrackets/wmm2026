/**
 * Warren's March Madness 2026 - Site Configuration
 * Now reads from Google Sheets with fallbacks to environment variables
 */

import { getSiteConfigFromGoogleSheets, getFallbackSiteConfig, SiteConfigData } from '@/lib/siteConfig';

// Cache for site config to avoid repeated API calls
let cachedConfig: SiteConfigData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to get site config with caching
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

// For backward compatibility, export a synchronous version that uses fallbacks
export const siteConfig = {
  // Current tournament year
  tournamentYear: process.env.NEXT_PUBLIC_TOURNAMENT_YEAR || '2026',
  
  // Last year's winner
  lastYearWinner: process.env.NEXT_PUBLIC_LAST_YEAR_WINNER || 'Randy Phillips (Randy Line Sports)',
  lastYearChampionship: parseInt(process.env.NEXT_PUBLIC_LAST_YEAR_CHAMPIONSHIP || '2025'),
  
  // Tournament start date and time
  tournamentStartDate: process.env.NEXT_PUBLIC_TOURNAMENT_START_DATE || '2026-03-18T12:00:00-05:00', // EST timezone
  tournamentStartTime: process.env.NEXT_PUBLIC_TOURNAMENT_START_TIME || '12:00 PM EST',
  
  // Number of players this year
  numberOfPlayers: parseInt(process.env.NEXT_PUBLIC_NUMBER_OF_PLAYERS || '0'),
  
  // Total prize amount this year
  totalPrizeAmount: parseInt(process.env.NEXT_PUBLIC_TOTAL_PRIZE_AMOUNT || '0'),
  
  // Site configuration
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Warren's March Madness",
  siteDescription: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Annual March Madness Bracket Challenge',
  
  // URLs
  oldSiteUrl: 'https://warrensmadness.webnode.page/',
  
  // Social sharing
  socialSharing: {
    enabled: false, // Future feature
  }
};

export default siteConfig;
