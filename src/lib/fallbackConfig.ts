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
  welcomeNoInProgress: 'Your total cost so far is ${cost}.||You can create a new entry and save it for later without submitting it now.',
  welcomeNoSubmitted: 'You have not submitted any brackets yet.||Please complete and submit your bracket(s) to be included in the contest.',
  welcomeYourBrackets: 'Your total cost so far is ${cost}.||In Progress brackets are not included in the contest until submitted.',
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
  finalFourHeaderMessage: 'Final Four & Championship',
  // Email PDF template defaults
  emailPdfSubject: 'Your Bracket - Warren\'s March Madness',
  emailPdfHeading: 'Your Bracket is Attached!',
  emailPdfGreeting: 'Hi {name},',
  emailPdfMessage1: 'Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament!',
  emailPdfMessage2: 'We\'ve attached a PDF copy of your bracket for your records. Good luck with your picks!',
  emailPdfMessage3: 'Let the madness begin! 🏀',
  emailPdfFooter: 'This is an automated email from Warren\'s March Madness.',
  // Email modal window defaults
  emailWindowTitle: 'Email Bracket PDF',
  emailWindowMessage: 'Would you like to send yourself an email with a PDF of your bracket "{Entry Name}"? The email will be sent to {email}.',
  emailBracketTitle: 'Email Bracket PDF',
  // Email submit (automated submission) defaults
  emailSubmitSubject: 'Bracket Submitted Successfully - Warren\'s March Madness',
  emailSubmitHeading: 'Bracket Submitted Successfully!',
  emailSubmitGreeting: 'Hi {name},',
  emailSubmitMessage1: 'Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament.',
  emailSubmitMessage2: 'You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}.',
  emailSubmitMessage3: 'Want to increase your chances? Submit more brackets and invite your friends to join the fun!',
  emailSubmitFooter: 'This is an automated email from Warren\'s March Madness.'
};

