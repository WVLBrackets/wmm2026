// Google Sheets integration for Site Configuration

import { unstable_cache } from 'next/cache';

// Google Sheet ID for Site Config
const SITE_CONFIG_SHEET_ID = '1BpNNLm9NfZdg5QgYalzKjxXeKQ-Lg8ng0GG5pwnhtPI';
// Tab GIDs: PROD tab = 0 (original), STAGE tab = 483518827
const SITE_CONFIG_GID_PROD = '0';
const SITE_CONFIG_GID_STAGE = '483518827';

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
  /** Sheet `show_live_standings`: when `YES`, logged-in users see Daily/Live toggle and can persist `live` vs `daily`. */
  showLiveStandings?: string;
  /** Logged-in Live standings: disclaimer before first visit (`||` = line breaks). Sheet: `live_standings_warning` */
  liveStandingsWarning?: string;
  /** Two button labels separated by `|` (left = accept Live, right = stay on daily). Sheet: `live_standings_buttons` */
  liveStandingsButtons?: string;
  /** Optional red banner atop `/standings/live` when non-empty (`||` = line breaks). Sheet: `live_standings_disclaimer` */
  liveStandingsDisclaimer?: string;
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
  /** Bracket editor: hover on disabled Final Four nav until all regions are complete. Sheet: `final_four_disabled_message` */
  finalFourDisabledMessage?: string;
  /** Bracket editor: banner atop each regional step (`||` = line break). Sheet: `bracket_regional_message` */
  bracketRegionalMessage?: string;
  /** Shown in the same banner when that region is complete (`||` = line break). Sheet: `bracket_regional_message_done` */
  bracketRegionalMessageDone?: string;
  // WMM logo used on brackets page, print bracket, and emailed PDF
  wmmLogo?: string;
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
  regEmailSpamReminder?: string;
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
  /** Bracket editor Final Four: inline help for tie breaker (`||` = paragraph break). Sheet: `tie_breaker_hint` */
  tieBreakerHint?: string;
  // Submission deadline and toggle
  stopSubmitDateTime?: string;
  showCountdownTimer?: string;
  countdownTimerMessage?: string;
  /** Sheet: `countdown_timer_message_mobile` — short “X Days …” template for My Picks countdown on small screens; falls back to `countdownTimerMessage`. */
  countdownTimerMessageMobile?: string;
  stopSubmitToggle?: string;
  finalMessageTooLate?: string;
  finalMessageSubmitOff?: string;
  // Global kill switch hover/help message
  killSwitchOn?: string;
  /** My Picks: permanent-delete confirmation (`perm_delete_message` in Sheets; `||` = line breaks). */
  permDeleteMessage?: string;
  /** My Picks: in-pool section — bold title (before em dash). Sheet: `in_the_pool_header` */
  inThePoolHeader?: string;
  /**
   * My Picks: in-pool section — text after em dash. Sheet: `in_the_pool_message`.
   * Optional `{X}` is replaced with `"{n} submitted entry"` or `"{n} submitted entries"` for the signed-in user’s submitted count (current tournament year).
   */
  inThePoolMessage?: string;
  /** My Picks: out-of-pool section — bold title. Sheet: `not_in_the_pool_header` */
  notInThePoolHeader?: string;
  /** My Picks: out-of-pool section — text after em dash. Sheet: `not_in_the_pool_message` */
  notInThePoolMessage?: string;
  /** My Picks: `desktopPx|mobilePx` — single `|`; first = header + icon + message on `md+`; second = same on smaller screens. Sheet: `pool_header_font_size` */
  poolHeaderFontSize?: string;
  /**
   * My Picks: Return (submitted → in progress) inline confirmation — `||` = line breaks.
   * Sheet: `return_action_confirm_message`
   */
  returnActionConfirmMessage?: string;
  /** My Picks: Return button tooltip when enabled. Sheet: `return_action_hover_message` */
  returnActionHoverMessage?: string;
  /** @deprecated Sheet `bracket_return_message` — use `return_action_confirm_message`; still used as fallback if new key is empty */
  bracketReturnMessage?: string;
  // Test configuration (browser-specific to avoid duplication)
  happy_path_email_test_chrome?: string;
  happy_path_email_test_firefox?: string;
  happy_path_email_test_webkit?: string;
  happy_path_email_test_mobile_chrome?: string;
  happy_path_email_test_mobile_webkit?: string;
  happy_path_email_test_mobile_webkit_pro?: string;
  // Email "Do Not Reply" notice configuration
  emailDoNotReplyNotice?: string;
  emailContactAddress?: string;
  // Generic spam reminder for all emails (falls back to regEmailSpamReminder if not set)
  emailSpamReminder?: string;
  // Auto-reply message configuration (for do-not-reply addresses)
  autoReplyHeading?: string;
  autoReplyGreeting?: string;
  autoReplyMainMessage?: string;
  autoReplyClosing?: string;
  // CTA configuration (Home page call-to-action cards)
  cta1Title?: string;
  cta1Destination?: string;
  cta1Image?: string;
  cta2Title?: string;
  cta2Destination?: string;
  cta2Image?: string;
  cta3Title?: string;
  cta3Destination?: string;
  cta3Image?: string;
  cta4Title?: string;
  cta4Destination?: string;
  cta4Image?: string;
  cta5Title?: string;
  cta5Destination?: string;
  cta5Image?: string;
  cta6Title?: string;
  cta6Destination?: string;
  cta6Image?: string;
  /** Venmo username (without @) for payment deep links; parsed from `venmo_user` in the Google Sheets config. */
  venmoUser?: string;
  /** When "YES", the Pay button is shown to all users; otherwise admin-only. Parsed from `enable_pay_capability`. */
  enablePayCapability?: string;
}

/**
 * Internal function to fetch site config from Google Sheets (uncached)
 * This is the actual implementation that hits the Google Sheets API
 */
async function fetchSiteConfigFromGoogleSheetsUncached(): Promise<SiteConfigData | null> {
  try {
    // Use Google Sheets public CSV export — select tab based on environment
    const isProduction = process.env.VERCEL_ENV === 'production';
    const gid = isProduction ? SITE_CONFIG_GID_PROD : SITE_CONFIG_GID_STAGE;
    // Cache-busting parameter prevents Google's CDN from serving stale CSV exports
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SITE_CONFIG_SHEET_ID}/export?format=csv&gid=${gid}&_t=${Date.now()}`;
    
    // Add timeout to prevent hanging (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(csvUrl, { 
        signal: controller.signal,
        cache: 'no-store',
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
          case 'show_live_standings':
            config.showLiveStandings = value;
            break;
          case 'live_standings_warning':
            config.liveStandingsWarning = value;
            break;
          case 'live_standings_buttons':
            config.liveStandingsButtons = value;
            break;
          case 'live_standings_disclaimer':
            config.liveStandingsDisclaimer = value;
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
          case 'venmo_user':
            config.venmoUser = value;
            break;
          case 'enable_pay_capability':
            config.enablePayCapability = value;
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
          case 'tie_breaker_hint':
            config.tieBreakerHint = value;
            break;
          case 'stop_submit_date_time':
            config.stopSubmitDateTime = value;
            break;
          case 'show_countdown_timer':
            config.showCountdownTimer = value;
            break;
          case 'countdown_timer_message':
            config.countdownTimerMessage = value;
            break;
          case 'countdown_timer_message_mobile':
            config.countdownTimerMessageMobile = value;
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
          case 'kill_switch_on':
            config.killSwitchOn = value;
            break;
          case 'perm_delete_message':
            config.permDeleteMessage = value;
            break;
          case 'in_the_pool_header':
            config.inThePoolHeader = value;
            break;
          case 'in_the_pool_message':
            config.inThePoolMessage = value;
            break;
          case 'not_in_the_pool_header':
            config.notInThePoolHeader = value;
            break;
          case 'not_in_the_pool_message':
            config.notInThePoolMessage = value;
            break;
          case 'pool_header_font_size':
            config.poolHeaderFontSize = value;
            break;
          case 'return_action_confirm_message':
            config.returnActionConfirmMessage = value;
            break;
          case 'return_action_hover_message':
            config.returnActionHoverMessage = value;
            break;
          case 'bracket_return_message':
            config.bracketReturnMessage = value;
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
          case 'final_four_disabled_message':
            config.finalFourDisabledMessage = value;
            break;
          case 'bracket_regional_message':
            config.bracketRegionalMessage = value;
            break;
          case 'bracket_regional_message_done':
            config.bracketRegionalMessageDone = value;
            break;
          case 'wmm_logo':
            config.wmmLogo = value;
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
          case 'reg_email_spam_reminder':
            config.regEmailSpamReminder = value;
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
          case 'happy_path_email_test_webkit':
            config.happy_path_email_test_webkit = value;
            break;
          case 'happy_path_email_test_mobile_chrome':
            config.happy_path_email_test_mobile_chrome = value;
            break;
          case 'happy_path_email_test_mobile_webkit':
            config.happy_path_email_test_mobile_webkit = value;
            break;
          case 'happy_path_email_test_mobile_webkit_pro':
            config.happy_path_email_test_mobile_webkit_pro = value;
            break;
          case 'email_do_not_reply_notice':
            config.emailDoNotReplyNotice = value;
            break;
          case 'email_contact_address':
            config.emailContactAddress = value;
            break;
          case 'email_spam_reminder':
            config.emailSpamReminder = value;
            break;
          case 'auto_reply_heading':
            config.autoReplyHeading = value;
            break;
          case 'auto_reply_greeting':
            config.autoReplyGreeting = value;
            break;
          case 'auto_reply_main_message':
            config.autoReplyMainMessage = value;
            break;
          case 'auto_reply_closing':
            config.autoReplyClosing = value;
            break;
          case 'cta1_title':
            config.cta1Title = value;
            break;
          case 'cta1_destination':
            config.cta1Destination = value;
            break;
          case 'cta1_image':
            config.cta1Image = value;
            break;
          case 'cta2_title':
            config.cta2Title = value;
            break;
          case 'cta2_destination':
            config.cta2Destination = value;
            break;
          case 'cta2_image':
            config.cta2Image = value;
            break;
          case 'cta3_title':
            config.cta3Title = value;
            break;
          case 'cta3_destination':
            config.cta3Destination = value;
            break;
          case 'cta3_image':
            config.cta3Image = value;
            break;
          case 'cta4_title':
            config.cta4Title = value;
            break;
          case 'cta4_destination':
            config.cta4Destination = value;
            break;
          case 'cta4_image':
            config.cta4Image = value;
            break;
          case 'cta5_title':
            config.cta5Title = value;
            break;
          case 'cta5_destination':
            config.cta5Destination = value;
            break;
          case 'cta5_image':
            config.cta5Image = value;
            break;
          case 'cta6_title':
            config.cta6Title = value;
            break;
          case 'cta6_destination':
            config.cta6Destination = value;
            break;
          case 'cta6_image':
            config.cta6Image = value;
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
    
    // Browser-specific test emails are used (happy_path_email_test_chrome, happy_path_email_test_firefox, happy_path_email_test_webkit)
    // Mobile-specific test emails are used (happy_path_email_test_mobile_chrome, happy_path_email_test_mobile_webkit, happy_path_email_test_mobile_webkit_pro)
    // No generic happy_path_email_test needed - browser/device-specific versions prevent duplication
    
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

