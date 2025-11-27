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
  // Email submit (automated submission) defaults
  emailSubmitSubject: 'Bracket Submitted Successfully - Warren\'s March Madness',
  emailSubmitHeading: 'Bracket Submitted Successfully!',
  emailSubmitGreeting: 'Hi {name},',
  emailSubmitMessage1: 'Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament.',
  emailSubmitMessage2: 'You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}.',
  emailSubmitMessage3: 'Want to increase your chances? Submit more brackets and invite your friends to join the fun!',
  emailSubmitFooter: 'This is an automated email from Warren\'s March Madness.',
  // Email registration (confirmation) defaults
  regEmailSubject: 'Confirm Your Warren\'s March Madness Account',
  regEmailHeader: 'Welcome to Warren\'s March Madness!',
  regEmailGreeting: 'Hi {Name},',
  regEmailMessage1: 'Thank you for signing up for Warren\'s March Madness {Year}!',
  regEmailMessage2: 'To complete your account setup, please confirm your email address by clicking the button below:',
  regEmailSpamReminder: '💡 <strong>Can\'t find this email?</strong> Please check your spam or junk mail folder. If you still don\'t see it, the email may take a few minutes to arrive.',
  regEmailFooter: 'If you didn\'t create an account with Warren\'s March Madness, please ignore this email.',
  // Account creation success page defaults
  acctCreateSuccessHeader: 'Check Your Email!',
  acctCreateSuccessMessage1: 'We\'ve sent a confirmation link to {email}',
  acctCreateSuccessMessage2: 'Please check your email and click the confirmation link to activate your account.',
  acctCreateSuccessButton: 'Go to Sign In',
  // Account confirmation success page defaults
  acctConfirmSuccessHeader: 'Email Confirmed!',
  acctConfirmSuccessMessage1: 'Your email has been confirmed successfully! You can now sign in.',
  acctConfirmSuccessButton1: 'Sign In Now',
  acctConfirmSuccessButton2: 'Go to My Picks',
  // Account confirmation failure page defaults
  acctConfirmFailureHeader: 'Confirmation Failed',
  acctConfirmFailureMessage1: 'Invalid or expired confirmation token',
  acctConfirmFailureButton1: 'Try Signing Up Again',
  acctConfirmFailureButton2: 'Sign In',
  // Sign-in error messages
  emailFailInvalid: 'Invalid email or password',
  emailFailNotConfirmed: 'Please confirm your email address before signing in. Check your email for a confirmation link.',
  // Print bracket trophy icon (default to trophy-icon.png)
  printBracketTrophy: 'trophy-icon.png',
  // Tie breaker validation
  tieBreakerLow: 50,
  tieBreakerHigh: 500,
  // Submission deadline and toggle
  stopSubmitDateTime: '',
  stopSubmitToggle: 'No',
  finalMessageTooLate: 'Bracket submissions are closed. The deadline has passed.',
  finalMessageSubmitOff: 'Bracket submissions are currently disabled.',
  // Auto-reply message configuration (for do-not-reply addresses)
  autoReplyHeading: 'Automatic Reply',
  autoReplyGreeting: 'Hello,',
  autoReplyMainMessage: 'Thank you for your message. However, you have replied to an automated email address that is not monitored.',
  autoReplyClosing: 'We apologize for any inconvenience. For the fastest response, please send your inquiry directly to the email address above.'
};

