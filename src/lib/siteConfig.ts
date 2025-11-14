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
  bracketsMessage?: string;
  mobileBracketsMessage?: string;
  welcomeNoBrackets?: string;
  welcomeNoInProgress?: string;
  welcomeNoSubmitted?: string;
  welcomeYourBrackets?: string;
  // Legacy fields (kept for backward compatibility)
  welcomeNoBracketsLine2: string;
  welcomeNoBracketsLine3: string;
  welcomeSubmittedText: string;
  welcomeInprogressText: string;
  welcomeInprogressReminder: string;
  welcomeCanStartNew: string;
  entrySingular: string;
  entryPlural: string;
  // Sign-in page configuration
  signinFooter: string;
  // Final Four validation messages
  finalMessageTeamsMissing?: string;
  finalMessageTieBreakerMissing?: string;
  finalMessageTieBreakerInvalid?: string;
  finalMessageDuplicateName?: string;
  finalMessageReadyToSubmit?: string;
  finalFourHeaderMessage?: string;
  // Home page logo
  homePageLogo?: string;
  // Email PDF template content
  emailPdfSubject?: string;
  emailPdfHeading?: string;
  emailPdfGreeting?: string;
  emailPdfMessage1?: string;
  emailPdfMessage2?: string;
  emailPdfMessage3?: string;
  emailPdfFooter?: string;
  // Email modal window content
  emailWindowTitle?: string;
  emailWindowMessage?: string;
  // Email submit (automated submission) template content
  emailSubmitSubject?: string;
  emailSubmitHeading?: string;
  emailSubmitGreeting?: string;
  emailSubmitMessage1?: string;
  emailSubmitMessage2?: string;
  emailSubmitMessage3?: string;
  emailSubmitFooter?: string;
  // Email registration (confirmation) template content
  regEmailSubject?: string;
  regEmailHeader?: string;
  regEmailGreeting?: string;
  regEmailMessage1?: string;
  regEmailMessage2?: string;
  regEmailFooter?: string;
  // Account creation success page content
  acctCreateSuccessHeader?: string;
  acctCreateSuccessMessage1?: string;
  acctCreateSuccessMessage2?: string;
  acctCreateSuccessButton?: string;
  // Account confirmation success page content
  acctConfirmSuccessHeader?: string;
  acctConfirmSuccessMessage1?: string;
  acctConfirmSuccessButton1?: string;
  acctConfirmSuccessButton2?: string;
  // Sign-in error messages
  emailFailInvalid?: string;
  emailFailNotConfirmed?: string;
  // Print bracket trophy icon
  printBracketTrophy?: string;
}

// Function to fetch site config from Google Sheets
export const getSiteConfigFromGoogleSheets = async (): Promise<SiteConfigData | null> => {
  try {
    // Use Google Sheets public CSV export
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SITE_CONFIG_SHEET_ID}/export?format=csv&gid=0`;
    
    // Add timeout to prevent hanging (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(csvUrl, { 
        signal: controller.signal,
        // Add headers to help with reliability
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Site config fetch timed out after 10 seconds');
      }
      throw fetchError;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch site config: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    // Parse the CSV data
    const config: Partial<SiteConfigData> = {};
    
    // Process ALL rows - don't skip any (except empty ones)
    for (let i = 1; i < lines.length; i++) { // Skip header row
      const line = lines[i].trim();
      // Only skip completely empty lines
      if (!line || line.length === 0) {
        continue;
      }
      
      const fields = parseCSVLine(line);
      if (fields.length >= 2) {
        const parameter = fields[0].trim().toLowerCase(); // Normalize to lowercase
        const value = fields[1].trim();
        
        // Map parameters to config properties (case-insensitive matching)
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
          case 'signin_footer':
            config.signinFooter = value;
            break;
          case 'brackets_message':
            config.bracketsMessage = value;
            break;
          case 'mobile_brackets_message':
            config.mobileBracketsMessage = value;
            break;
          case 'welcome_no_brackets':
            config.welcomeNoBrackets = value;
            break;
          case 'welcome_no_in_progress':
            config.welcomeNoInProgress = value;
            break;
          case 'welcome_no_submitted':
            config.welcomeNoSubmitted = value;
            break;
          case 'welcome_your_brackets':
            config.welcomeYourBrackets = value;
            break;
          case 'final_message_teams_missing':
            config.finalMessageTeamsMissing = value;
            break;
          case 'final_message_tie_breaker_missing':
            config.finalMessageTieBreakerMissing = value;
            break;
          case 'final_message_tie_breaker_invalid':
            config.finalMessageTieBreakerInvalid = value;
            break;
          case 'final_message_duplicate_name':
            config.finalMessageDuplicateName = value;
            break;
          case 'final_message_ready_to_submit':
            config.finalMessageReadyToSubmit = value;
            break;
          case 'final_four_header_message':
            config.finalFourHeaderMessage = value;
            break;
          case 'home_page_logo':
            config.homePageLogo = value;
            break;
          case 'email_pdf_subject':
            config.emailPdfSubject = value;
            break;
          case 'email_pdf_heading':
            config.emailPdfHeading = value;
            break;
          case 'email_pdf_greeting':
            config.emailPdfGreeting = value;
            break;
          case 'email_pdf_message1':
            config.emailPdfMessage1 = value;
            break;
          case 'email_pdf_message2':
            config.emailPdfMessage2 = value;
            break;
          case 'email_pdf_message3':
            config.emailPdfMessage3 = value;
            break;
          case 'email_pdf_footer':
            config.emailPdfFooter = value;
            break;
          case 'email_window_title':
            config.emailWindowTitle = value;
            break;
          case 'email_window_message':
            config.emailWindowMessage = value;
            break;
          case 'email_submit_subject':
            config.emailSubmitSubject = value;
            break;
          case 'email_submit_heading':
            config.emailSubmitHeading = value;
            break;
          case 'email_submit_greeting':
            config.emailSubmitGreeting = value;
            break;
          case 'email_submit_message1':
            config.emailSubmitMessage1 = value;
            break;
          case 'email_submit_message2':
            config.emailSubmitMessage2 = value;
            break;
          case 'email_submit_message3':
            config.emailSubmitMessage3 = value;
            break;
          case 'email_submit_footer':
            config.emailSubmitFooter = value;
            break;
          case 'reg_email_subject':
            config.regEmailSubject = value;
            break;
          case 'reg_email_header':
            config.regEmailHeader = value;
            break;
          case 'reg_email_greeting':
            config.regEmailGreeting = value;
            break;
          case 'reg_email_message1':
            config.regEmailMessage1 = value;
            break;
          case 'reg_email_message2':
            config.regEmailMessage2 = value;
            break;
          case 'reg_email_footer':
            config.regEmailFooter = value;
            break;
          case 'acct_create_success_header':
            config.acctCreateSuccessHeader = value;
            break;
          case 'acct_create_success_message1':
            config.acctCreateSuccessMessage1 = value;
            break;
          case 'acct_create_success_message2':
            config.acctCreateSuccessMessage2 = value;
            break;
          case 'acct_create_success_button':
            config.acctCreateSuccessButton = value;
            break;
          case 'acct_confirm_success_header':
            config.acctConfirmSuccessHeader = value;
            break;
          case 'acct_confirm_success_message1':
            config.acctConfirmSuccessMessage1 = value;
            break;
          case 'acct_confirm_success_button1':
            config.acctConfirmSuccessButton1 = value;
            break;
          case 'acct_confirm_success_button2':
            config.acctConfirmSuccessButton2 = value;
            break;
          case 'email_fail_invalid':
            config.emailFailInvalid = value;
            break;
          case 'email_fail_not_confirmed':
            config.emailFailNotConfirmed = value;
            break;
          case 'print_bracket_trophy':
            config.printBracketTrophy = value;
            break;
          default:
            // Unknown parameter - skip it silently
            break;
        }
      }
      // Skip rows that don't have at least 2 fields
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

