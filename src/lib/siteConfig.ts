// Google Sheets integration for Site Configuration

import { unstable_cache } from 'next/cache';

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
  // Account confirmation failure page content
  acctConfirmFailureHeader?: string;
  acctConfirmFailureMessage1?: string;
  acctConfirmFailureButton1?: string;
  acctConfirmFailureButton2?: string;
  // Sign-in error messages
  emailFailInvalid?: string;
  emailFailNotConfirmed?: string;
  // Print bracket trophy icon
  printBracketTrophy?: string;
  // Tie breaker validation
  tieBreakerLow?: number;
  tieBreakerHigh?: number;
  // Submission deadline and toggle
  stopSubmitDateTime?: string;
  stopSubmitToggle?: string;
  finalMessageTooLate?: string;
  finalMessageSubmitOff?: string;
  // Test configuration (browser-specific to avoid duplication)
  happy_path_email_test_chrome?: string;
  happy_path_email_test_firefox?: string;
  // Email "Do Not Reply" notice configuration
  emailDoNotReplyNotice?: string;
  emailContactAddress?: string;
}

/**
 * Internal function to fetch site config from Google Sheets (uncached)
 * This is the actual implementation that hits the Google Sheets API
 */
async function fetchSiteConfigFromGoogleSheetsUncached(): Promise<SiteConfigData | null> {
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
    
    // Debug: Track all parameters for debugging
    const allParameters: string[] = [];
    const matchingParameters: Array<{raw: string, normalized: string, value: string}> = [];
    
    // Process ALL rows - continue until we encounter two consecutive blank rows
    let consecutiveBlanks = 0;
    for (let i = 1; i < lines.length; i++) { // Skip header row
      const line = lines[i].trim();
      
      // Check if this line is blank
      if (!line || line.length === 0) {
        consecutiveBlanks++;
        // Stop if we encounter two consecutive blank rows
        if (consecutiveBlanks >= 2) {
          break;
        }
        continue;
      }
      
      // Reset consecutive blanks counter when we find a non-blank line
      consecutiveBlanks = 0;
      
      const fields = parseCSVLine(line);
      if (fields.length >= 2) {
        const parameterRaw = fields[0].trim();
        // Normalize: lowercase, replace spaces with underscores, replace hyphens with underscores
        const parameter = parameterRaw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        const value = fields[1].trim();
        
        // Track all parameters for debugging
        allParameters.push(parameterRaw);
        
        // Debug: Log parameters that might match
        if (parameter.includes('happy') || (parameter.includes('test') && parameter.includes('email'))) {
          matchingParameters.push({raw: parameterRaw, normalized: parameter, value});
          console.log(`[SiteConfig] Found matching parameter: "${parameterRaw}" (normalized: "${parameter}") = "${value}"`);
        }
        
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
          case 'tie_breaker_low':
            config.tieBreakerLow = parseInt(value, 10) || undefined;
            break;
          case 'tie_breaker_high':
            config.tieBreakerHigh = parseInt(value, 10) || undefined;
            break;
          case 'stop_submit_date_time':
            config.stopSubmitDateTime = value;
            break;
          case 'stop_submit_toggle':
            config.stopSubmitToggle = value;
            break;
          case 'final_message_too_late':
            config.finalMessageTooLate = value;
            break;
          case 'final_message_submit_off':
            config.finalMessageSubmitOff = value;
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
          case 'acct_confirm_failure_header':
            config.acctConfirmFailureHeader = value;
            break;
          case 'acct_confirm_failure_message1':
            config.acctConfirmFailureMessage1 = value;
            break;
          case 'acct_confirm_failure_button1':
            config.acctConfirmFailureButton1 = value;
            break;
          case 'acct_confirm_failure_button2':
            config.acctConfirmFailureButton2 = value;
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
          case 'happy_path_email_test_chrome':
            config.happy_path_email_test_chrome = value;
            break;
          case 'happy_path_email_test_firefox':
            config.happy_path_email_test_firefox = value;
            break;
          case 'email_do_not_reply_notice':
            config.emailDoNotReplyNotice = value;
            break;
          case 'email_contact_address':
            config.emailContactAddress = value;
            break;
          default:
            // Unknown parameter - log for debugging (only in development)
            if (process.env.NODE_ENV === 'development') {
              console.log(`Unknown config parameter: ${parameter} = ${value}`);
            }
            break;
        }
      }
      // Skip rows that don't have at least 2 fields
    }
    
    // Browser-specific test emails are used (happy_path_email_test_chrome, happy_path_email_test_firefox)
    // No generic happy_path_email_test needed - browser-specific versions prevent duplication
    
    // Validate that we have all required fields
    if (config.tournamentYear && config.lastYearWinner && config.siteName) {
      return config as SiteConfigData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching site config from Google Sheets:', error);
    return null;
  }
}

/**
 * Get site config from Google Sheets with caching (7.5 minute TTL)
 * Use this for general config access where real-time values aren't critical
 * 
 * For validation checks (bracket creation/submission), use getSiteConfigFromGoogleSheetsFresh()
 */
export const getSiteConfigFromGoogleSheets = unstable_cache(
  async (): Promise<SiteConfigData | null> => {
    return await fetchSiteConfigFromGoogleSheetsUncached();
  },
  ['site-config'],
  { 
    revalidate: 300, // 5 minutes
    tags: ['site-config']
  }
);

/**
 * Get site config from Google Sheets WITHOUT caching (real-time)
 * Use this for validation checks where we need the latest values:
 * - Before creating a new bracket (New Bracket or Copy buttons)
 * - Before submitting a bracket
 * 
 * This bypasses the cache to ensure we check the current state of
 * stop_submit_toggle and stop_submit_date_time
 */
export async function getSiteConfigFromGoogleSheetsFresh(): Promise<SiteConfigData | null> {
  return await fetchSiteConfigFromGoogleSheetsUncached();
}

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

