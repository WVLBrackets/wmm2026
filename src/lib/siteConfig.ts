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
  standingsYear: string;
  footerText: string;
  contactMe: string;
  prizesActiveForecast: string;
  showPicksDev: string;
  showPicksProd: string;
  // Welcome banner configuration
  welcomeGreeting: string;
  entryCost: number;
  welcomeNoBracketsLine2: string;
  welcomeNoBracketsLine3: string;
  welcomeSubmittedText: string;
  welcomeInprogressText: string;
  welcomeInprogressReminder: string;
  welcomeCanStartNew: string;
  entrySingular: string;
  entryPlural: string;
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
          case 'standings_year':
            config.standingsYear = value;
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
          case 'show_picks_dev':
            config.showPicksDev = value;
            break;
          case 'show_picks_prod':
            config.showPicksProd = value;
            break;
          case 'welcome_greeting':
            config.welcomeGreeting = value;
            break;
          case 'entry_cost':
            config.entryCost = parseInt(value) || 5;
            break;
          case 'welcome_no_brackets_line2':
            config.welcomeNoBracketsLine2 = value;
            break;
          case 'welcome_no_brackets_line3':
            config.welcomeNoBracketsLine3 = value;
            break;
          case 'welcome_submitted_text':
            config.welcomeSubmittedText = value;
            break;
          case 'welcome_inprogress_text':
            config.welcomeInprogressText = value;
            break;
          case 'welcome_inprogress_reminder':
            config.welcomeInprogressReminder = value;
            break;
          case 'welcome_can_start_new':
            config.welcomeCanStartNew = value;
            break;
          case 'entry_singular':
            config.entrySingular = value;
            break;
          case 'entry_plural':
            config.entryPlural = value;
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

