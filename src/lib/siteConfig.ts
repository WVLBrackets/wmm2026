// Google Sheets integration for Site Configuration

// Google Sheet ID for Site Config
const SITE_CONFIG_SHEET_ID = '1BpNNLm9NfZdg5QgYalzKjxXeKQ-Lg8ng0GG5pwnhtPI';

export interface SiteConfigData {
  tournamentYear: string;
  lastYearWinner: string;
  lastYearChampionship: number;
  tournamentStartDate: string;
  tournamentStartTime: string;
  numberOfPlayers: number;
  totalPrizeAmount: number;
  siteName: string;
  siteDescription: string;
  oldSiteUrl: string;
  standingsTabs: number;
  footerText: string;
  contactMe: string;
  prizesActiveForecast: string;
}

// Function to fetch site config from Google Sheets
export const getSiteConfigFromGoogleSheets = async (): Promise<SiteConfigData | null> => {
  try {
    // Use Google Sheets public CSV export
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SITE_CONFIG_SHEET_ID}/export?format=csv&gid=0`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch site config: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    // Parse the CSV data
    const config: Partial<SiteConfigData> = {};
    
    for (let i = 1; i < lines.length; i++) { // Skip header row
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length >= 2) {
        const parameter = fields[0].trim();
        const value = fields[1].trim();
        
        // Map parameters to config properties
        switch (parameter) {
          case 'tournament_year':
            config.tournamentYear = value;
            break;
          case 'last_year_winner':
            config.lastYearWinner = value;
            break;
          case 'last_year_championship':
            config.lastYearChampionship = parseInt(value) || 2025;
            break;
          case 'tournament_start_date':
            config.tournamentStartDate = value;
            break;
          case 'tournament_start_time':
            config.tournamentStartTime = value;
            break;
          case 'player_count':
            config.numberOfPlayers = parseInt(value) || 0;
            break;
          case 'total_prize_amount':
            config.totalPrizeAmount = parseInt(value) || 0;
            break;
          case 'site_name':
            config.siteName = value;
            break;
          case 'site_description':
            config.siteDescription = value;
            break;
          case 'old_site_url':
            config.oldSiteUrl = value;
            break;
          case 'standings_tabs':
            config.standingsTabs = parseInt(value) || 2;
            break;
          case 'footer_text':
            config.footerText = value;
            break;
          case 'contact_me':
            config.contactMe = value;
            break;
          case 'prizes_active_forecast':
            config.prizesActiveForecast = value;
            break;
        }
      }
    }
    
    // Validate that we have all required fields
    if (config.tournamentYear && config.lastYearWinner && config.siteName) {
      return config as SiteConfigData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching site config from Google Sheets:', error);
    return null;
  }
};

// Helper function to parse CSV line with proper handling of quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Fallback configuration (same as original site.ts)
export const getFallbackSiteConfig = (): SiteConfigData => ({
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
  footerText: process.env.NEXT_PUBLIC_FOOTER_TEXT || '© 2001 Warren\'s March Madness | All rights reserved',
  contactMe: process.env.NEXT_PUBLIC_CONTACT_ME || 'warren@example.com',
  prizesActiveForecast: process.env.NEXT_PUBLIC_PRIZES_ACTIVE_FORECAST || 'Forecast',
});
