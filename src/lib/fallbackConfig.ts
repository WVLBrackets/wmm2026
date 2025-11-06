import { SiteConfigData } from './siteConfig';

/**
 * Centralized fallback configuration
 * Used when Google Sheets config cannot be loaded
 * This is the ONLY place where fallback values should be defined
 */
export const FALLBACK_CONFIG: SiteConfigData = {
  tournamentYear: '2026',
  lastYearWinner: 'Randy Phillips (Randy Line Sports)',
  lastYearChampionship: 2025,
  tournamentStartDate: '2026-03-18T12:00:00-05:00',
  tournamentStartTime: '12:00 PM EST',
  numberOfPlayers: 0,
  totalPrizeAmount: 0,
  siteName: "Warren's March Madness",
  siteDescription: 'Annual March Madness Bracket Challenge',
  oldSiteUrl: 'https://warrensmadness.webnode.page/',
  standingsTabs: 2,
  standingsYear: '2026',
  footerText: '© 2001 Warren\'s March Madness | All rights reserved',
  contactMe: 'warren@example.com',
  prizesActiveForecast: 'Forecast',
  showPicksDev: 'Yes',
  showPicksProd: 'No',
  // Welcome banner defaults
  welcomeGreeting: 'Welcome back {name}',
  entryCost: 5,
  bracketsMessage: 'Create and submit your picks here',
  mobileBracketsMessage: 'Create and submit your picks here',
  welcomeNoBrackets: 'Click New Bracket to start your first entry',
  welcomeNoInProgress: 'Your total cost so far is ${cost}. You can create a new entry and save it for later without submitting it now.',
  welcomeNoSubmitted: 'You have not submitted any brackets yet. Please complete and submit your bracket(s) to be included in the contest.',
  welcomeYourBrackets: 'Your total cost so far is ${cost}. In Progress brackets are not included in the contest until submitted.',
  // Legacy fields (kept for backward compatibility)
  welcomeNoBracketsLine2: 'Click New Bracket to start your entry',
  welcomeNoBracketsLine3: 'You can start a new entry and save it for later without submitting it now',
  welcomeSubmittedText: 'Submitted Count: {count} - your total cost is ${cost} so far',
  welcomeInprogressText: 'In Progress Count: {count} - be sure to \'Submit\' if you want {entry_text} to count',
  welcomeInprogressReminder: 'Be sure to submit your picks so they can be included in the contest',
  welcomeCanStartNew: 'You can start a new entry and save it for later without submitting it now',
  entrySingular: 'this entry',
  entryPlural: 'these entries',
  // Sign-in page configuration
  signinFooter: '',
  // Final Four validation messages
  finalMessageTeamsMissing: 'Please select winners for all Final Four and Championship games.',
  finalMessageTieBreakerMissing: 'Please enter a tie breaker value.',
  finalMessageTieBreakerInvalid: 'Tie breaker must be between 100 and 300.',
  finalMessageDuplicateName: 'An entry with this name already exists for this year. Please choose a different name.',
  finalMessageReadyToSubmit: 'Your bracket is complete and ready to submit!',
  finalFourHeaderMessage: 'Final Four & Championship'
};

