import {
  assertCopyLengths,
  formatCopy,
  normalizeCopyTree,
  type CopyTree,
} from "./copyTree";

/** Copy for one transactional email (subject, heading, greeting, body, footer). */
export interface VintageEmailMessageCopy extends CopyTree {
  subject: string;
  heading: string;
  greeting: string;
  message1: string;
  message2: string;
  message3: string;
  footer: string;
}

/** Copy for a link-based account email (registration confirm / password reset). */
export interface VintageAccountEmailCopy extends CopyTree {
  subject: string;
  heading: string;
  greeting: string;
  message1: string;
  message2: string;
  buttonLabel: string;
  linkFallbackLabel: string;
  /** Tokens: `{code}`. */
  codeLabel: string;
  expiryNote: string;
  footer: string;
}

/** Auto-reply sent when someone replies to the no-reply mailbox. */
export interface VintageAutoReplyCopy extends CopyTree {
  /** Tokens: `{subject}` (original subject without a leading `Re:`). */
  subject: string;
  heading: string;
  greeting: string;
  mainMessage: string;
  closing: string;
}

/** On-site account pages: sign-in errors, sign-up success, confirm, forgot/reset. */
export interface VintageAccountPagesCopy extends CopyTree {
  signInInvalid: string;
  signInNotConfirmed: string;
  genericError: string;
  createAccountFailed: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  /** Tokens: `{email}`. `||` line breaks. */
  createSuccessHeading: string;
  createSuccessMessage1: string;
  createSuccessMessage2: string;
  createSuccessSpamHeading: string;
  createSuccessSpamMessage: string;
  createSuccessButton: string;
  confirmPendingHeading: string;
  confirmPendingMessage: string;
  confirmSuccessHeading: string;
  /** Tokens: `{email}`. */
  confirmSuccessMessage: string;
  confirmSuccessSignInButton: string;
  confirmSuccessPicksButton: string;
  confirmSigningInLabel: string;
  confirmFailureHeading: string;
  confirmFailureMessage: string;
  confirmFailureSignUpButton: string;
  confirmFailureSignInButton: string;
  forgotHeading: string;
  forgotLede: string;
  forgotEmailLabel: string;
  forgotEmailPlaceholder: string;
  forgotSubmitLabel: string;
  forgotSubmitPendingLabel: string;
  forgotFailed: string;
  forgotSuccessHeading: string;
  /** Tokens: `{email}`. */
  forgotSuccessMessage: string;
  forgotTryAnotherLabel: string;
  backToSignInLabel: string;
  resetHeading: string;
  resetLede: string;
  resetPasswordLabel: string;
  resetPasswordPlaceholder: string;
  resetConfirmLabel: string;
  resetConfirmPlaceholder: string;
  resetSubmitLabel: string;
  resetSubmitPendingLabel: string;
  resetFailed: string;
  resetMissingToken: string;
  resetSuccessHeading: string;
  resetSuccessMessage: string;
  resetRedirectingMessage: string;
  resetInvalidHeading: string;
  resetInvalidMessage: string;
  resetRequestNewLabel: string;
}

/** Email PDF dialog on My Picks. */
export interface VintagePdfDialogCopy extends CopyTree {
  title: string;
  /** Tokens: `{entry}`, `{email}`. */
  message: string;
  sendLabel: string;
  cancelLabel: string;
  sendingMessage: string;
  successMessage: string;
  failureMessage: string;
}

/** Emails & Account CMS section (`__emailsContent`). */
export interface VintageEmailsContent extends CopyTree {
  /** Tokens: `{contactEmail}`. */
  doNotReplyNotice: string;
  submit: VintageEmailMessageCopy;
  pdf: VintageEmailMessageCopy;
  registration: VintageAccountEmailCopy;
  passwordReset: VintageAccountEmailCopy;
  autoReply: VintageAutoReplyCopy;
  account: VintageAccountPagesCopy;
  pdfDialog: VintagePdfDialogCopy;
}

/** Editor seed (copy that shipped before the CMS move). */
export const DEFAULT_VINTAGE_EMAILS_CONTENT: VintageEmailsContent = {
  doNotReplyNotice:
    "Please do not reply to this email. This is an automated message from an unmonitored mailbox. If you need assistance, please contact us at {contactEmail}.",
  submit: {
    subject: "Bracket Submitted Successfully - Warren's March Madness",
    heading: "Bracket Submitted Successfully!",
    greeting: "Hi {name},",
    message1:
      'Congratulations! Your bracket "{entryName}" has been successfully submitted for the {tournamentYear} tournament.',
    /** Tokens: `{bracketsUrl}`, `{tipoff}`. Use `||` for a paragraph break. */
    message2:
      "You can view your {tournamentYear} brackets here: {bracketsUrl}||Please ensure you Submit all entries you want to include before tipoff at {tipoff}.",
    message3:
      "Want to increase your chances? Submit more brackets and invite your friends to join the fun!",
    footer: "This is an automated email from Warren's March Madness.",
  },
  pdf: {
    subject: "Your {tournamentYear} Bracket - Warren's March Madness",
    heading: "Your Bracket is Attached!",
    greeting: "Hi {name},",
    /** Tokens: `{entryName}`, `{tournamentYear}`. */
    message1:
      'Here is a PDF of your bracket "{entryName}" for the {tournamentYear} tournament.',
    /** Tokens: `{tournamentYear}`, `{bracketsUrl}` (year-scoped My Picks URL). */
    message2:
      "You can view your {tournamentYear} brackets here: {bracketsUrl}",
    message3: "Good luck with your picks — let the madness begin!",
    footer: "This is an automated email from Warren's March Madness.",
  },
  registration: {
    subject: "Confirm Your Warren's March Madness Account",
    heading: "Welcome to Warren's March Madness!",
    greeting: "Hi {name},",
    message1: "Thank you for signing up for Warren's March Madness {year}!",
    message2:
      "To complete your account setup, please confirm your email address by clicking the button below:",
    buttonLabel: "Confirm My Account",
    linkFallbackLabel: "Or copy and paste this link into your browser:",
    codeLabel: "Your confirmation code is: {code}",
    expiryNote: "This link will expire in 24 hours.",
    footer:
      "If you didn't create an account with Warren's March Madness, please ignore this email.",
  },
  passwordReset: {
    subject: "Password Reset - Warren's March Madness",
    heading: "Password Reset Request",
    greeting: "Hi {name},",
    message1:
      "We received a request to reset your password for your Warren's March Madness account.",
    message2: "To reset your password, please click the button below:",
    buttonLabel: "Reset My Password",
    linkFallbackLabel: "Or copy and paste this link into your browser:",
    codeLabel: "Your reset code is: {code}",
    expiryNote: "This link will expire in 1 hour.",
    footer:
      "If you didn't request a password reset, please ignore this email. Your password will remain unchanged.",
  },
  autoReply: {
    subject: "Re: {subject} - Do Not Reply",
    heading: "Automatic Reply",
    greeting: "Hello,",
    mainMessage:
      "Thank you for your message. However, you have replied to an automated email address that is not monitored.",
    closing:
      "We apologize for any inconvenience. For the fastest response, please send your inquiry directly to the email address above.",
  },
  account: {
    signInInvalid: "Invalid email or password",
    signInNotConfirmed:
      "Please confirm your email address before signing in. Check your email for a confirmation link.",
    genericError: "An error occurred. Please try again.",
    createAccountFailed: "Failed to create account",
    showPasswordLabel: "Show password",
    hidePasswordLabel: "Hide password",
    createSuccessHeading: "Check Your Email!",
    createSuccessMessage1: "We've sent a confirmation link to {email}",
    createSuccessMessage2:
      "Please check your email and click the confirmation link to activate your account.",
    createSuccessSpamHeading: "Can't find the email?",
    createSuccessSpamMessage:
      "Please check your spam or junk mail folder. If you still don't see it, the email may take a few minutes to arrive.",
    createSuccessButton: "Go to Sign In",
    confirmPendingHeading: "Confirming your email...",
    confirmPendingMessage: "Please wait while we verify your email address.",
    confirmSuccessHeading: "Email Confirmed!",
    confirmSuccessMessage:
      "Your email has been confirmed successfully! You can now sign in.",
    confirmSuccessSignInButton: "Sign In Now",
    confirmSuccessPicksButton: "Go to My Picks",
    confirmSigningInLabel: "Signing in...",
    confirmFailureHeading: "Confirmation Failed",
    confirmFailureMessage: "Invalid or expired confirmation token",
    confirmFailureSignUpButton: "Try Signing Up Again",
    confirmFailureSignInButton: "Sign In",
    forgotHeading: "Forgot Password",
    forgotLede:
      "Enter your email address and we'll send you instructions to reset your password.",
    forgotEmailLabel: "Email address",
    forgotEmailPlaceholder: "Enter your email address.",
    forgotSubmitLabel: "Send Reset Instructions",
    forgotSubmitPendingLabel: "Sending...",
    forgotFailed: "Failed to send reset email",
    forgotSuccessHeading: "Check your email",
    forgotSuccessMessage: "We've sent password reset instructions to {email}",
    forgotTryAnotherLabel: "Try another email",
    backToSignInLabel: "Back to Sign In",
    resetHeading: "Reset your password",
    resetLede: "Enter your new password below",
    resetPasswordLabel: "New Password",
    resetPasswordPlaceholder: "Enter your new password",
    resetConfirmLabel: "Confirm New Password",
    resetConfirmPlaceholder: "Confirm your new password",
    resetSubmitLabel: "Reset Password",
    resetSubmitPendingLabel: "Resetting password...",
    resetFailed: "Failed to reset password",
    resetMissingToken: "No reset token provided",
    resetSuccessHeading: "Password Reset Successfully!",
    resetSuccessMessage:
      "Your password has been updated. You can now sign in with your new password.",
    resetRedirectingMessage: "Redirecting to sign in page...",
    resetInvalidHeading: "Invalid Reset Link",
    resetInvalidMessage: "This password reset link is invalid or has expired.",
    resetRequestNewLabel: "Request New Reset Link",
  },
  pdfDialog: {
    title: "Email Bracket PDF",
    message:
      'Would you like to send yourself an email with a PDF of your bracket "{entry}"? The email will be sent to {email}.',
    sendLabel: "Send Email",
    cancelLabel: "Cancel",
    sendingMessage: "Sending your bracket PDF…",
    successMessage: "Email sent! Check your inbox for the PDF.",
    failureMessage: "We couldn't send the email. Please try again.",
  },
};

/** Stock submit `message2` before the My Picks link / tipoff rewrite. */
const LEGACY_SUBMIT_COUNT_COST_MESSAGE2 =
  "You currently have {submissionCount} submitted bracket(s) with a total cost of ${totalCost}.";

/** Earlier submit `message2` that said “current year” instead of `{tournamentYear}`. */
const LEGACY_SUBMIT_CURRENT_YEAR_MESSAGE2 =
  "You can view all your brackets for the current year here: {bracketsUrl}||Please ensure you Submit all entries you want to include before tipoff at {tipoff}.";

/** Stock PDF fields before the year + My Picks link rewrite. */
const LEGACY_PDF_SUBJECT = "Your Bracket - Warren's March Madness";
const LEGACY_PDF_MESSAGE1 =
  'Great news! Your bracket "{entryName}" has been successfully submitted and is ready for the tournament!';
const LEGACY_PDF_MESSAGE2 =
  "We've attached a PDF copy of your bracket for your records. Good luck with your picks!";
const LEGACY_PDF_MESSAGE3 = "Let the madness begin! 🏀";

/**
 * Swap a stored leaf for the new default when it still matches a known stock value.
 *
 * @param current - Stored / normalized value
 * @param legacy - Exact stock text to replace
 * @param next - Replacement from current defaults
 */
function replaceLegacyStock(
  current: string,
  legacy: string,
  next: string,
): string {
  return current.trim() === legacy ? next : current;
}

/**
 * Coerce stored JSON into the Emails & Account shape (editor seed fill).
 * Upgrades known stock submit/PDF lines to the year-aware My Picks copy when
 * the stored text still matches the old defaults.
 *
 * @param value - Raw sidecar JSON
 */
export function normalizeVintageEmailsContent(
  value: unknown,
): VintageEmailsContent {
  const normalized = normalizeCopyTree(value, DEFAULT_VINTAGE_EMAILS_CONTENT);
  const submitDefaults = DEFAULT_VINTAGE_EMAILS_CONTENT.submit;
  const pdfDefaults = DEFAULT_VINTAGE_EMAILS_CONTENT.pdf;

  normalized.submit.message2 = replaceLegacyStock(
    normalized.submit.message2,
    LEGACY_SUBMIT_COUNT_COST_MESSAGE2,
    submitDefaults.message2,
  );
  normalized.submit.message2 = replaceLegacyStock(
    normalized.submit.message2,
    LEGACY_SUBMIT_CURRENT_YEAR_MESSAGE2,
    submitDefaults.message2,
  );

  normalized.pdf.subject = replaceLegacyStock(
    normalized.pdf.subject,
    LEGACY_PDF_SUBJECT,
    pdfDefaults.subject,
  );
  normalized.pdf.message1 = replaceLegacyStock(
    normalized.pdf.message1,
    LEGACY_PDF_MESSAGE1,
    pdfDefaults.message1,
  );
  normalized.pdf.message2 = replaceLegacyStock(
    normalized.pdf.message2,
    LEGACY_PDF_MESSAGE2,
    pdfDefaults.message2,
  );
  normalized.pdf.message3 = replaceLegacyStock(
    normalized.pdf.message3,
    LEGACY_PDF_MESSAGE3,
    pdfDefaults.message3,
  );

  return normalized;
}

/**
 * Throw when any field is oversized.
 *
 * @param content - Normalized section
 */
export function validateVintageEmailsContent(
  content: VintageEmailsContent,
): void {
  assertCopyLengths(content, 2000);
}

/**
 * Fill `{token}` placeholders in Emails & Account copy.
 *
 * @param template - CMS copy
 * @param vars - Token values
 */
export function formatEmailCopy(
  template: string,
  vars: Record<string, string | number>,
): string {
  return formatCopy(template, vars);
}
