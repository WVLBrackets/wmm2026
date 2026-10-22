import type { SiteConfigData } from '@/lib/siteConfig';
import { checkSubmissionAllowed } from '@/lib/bracketSubmissionValidator';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

export type PicksBlockReasonCode =
  | 'prior_year'
  | 'brackets_not_available'
  | 'brackets_missing_json'
  /** Vintage: homepage tipoff has passed. */
  | 'tourney_active'
  /** Legacy Config Sheet stop_submit toggle / deadline. */
  | 'submission_closed'
  | 'master_lock'
  | 'none';

export type PicksAccessResult = {
  /** True when create/edit/submit/delete should be blocked. */
  blocked: boolean;
  /** User-facing explanation (already formatted). */
  message: string;
  reasonCode: PicksBlockReasonCode;
};

/**
 * Resolve common placeholders in the brackets-not-available sheet message.
 * Supports `<date time>`, `<tournament_year>`, and `||` line breaks (rendered by My Picks).
 * Datetime values are shown in Eastern time with an `EST` suffix.
 *
 * @param template - Message from config
 * @param options.dateTimeRaw - ISO/display string from `brackets_available_date_time`
 * @param options.tournamentYear - Active year from `tournament_year`
 */
export function formatBracketsNotAvailableMessage(
  template: string,
  options?: {
    dateTimeRaw?: string;
    tournamentYear?: string | number;
  }
): string {
  const fallback =
    FALLBACK_CONFIG.bracketsNotAvailableMessage ||
    'Bracket data is not published yet. Please check back on <date time>';
  let message = (template || fallback).trim();

  const year =
    options?.tournamentYear !== undefined && String(options.tournamentYear).trim()
      ? String(options.tournamentYear).trim()
      : String(FALLBACK_CONFIG.tournamentYear || new Date().getFullYear());
  message = message
    .replace(/<tournament_year>/gi, year)
    .replace(/\{\{tournament_year\}\}/gi, year)
    .replace(/\{tournamentYear\}/g, year)
    .replace(/\{tournament_year\}/gi, year);

  const dateTimeRaw = options?.dateTimeRaw;
  if (!dateTimeRaw?.trim()) {
    return message
      .replace(/<date time>/gi, 'a later date')
      .replace(/\{\{date time\}\}/gi, 'a later date');
  }

  let display = dateTimeRaw.trim();
  try {
    const parsed = new Date(dateTimeRaw);
    if (!Number.isNaN(parsed.getTime())) {
      display =
        parsed.toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'America/New_York',
        }) + ' EST';
    } else if (!/\bEST\b/i.test(display)) {
      display = `${display} EST`;
    }
  } catch {
    if (!/\bEST\b/i.test(display)) {
      display = `${display} EST`;
    }
  }

  return message
    .replace(/<date time>/gi, display)
    .replace(/\{\{date time\}\}/gi, display);
}

/**
 * Whether site config says the bracket field has been released (`brackets_available = YES`).
 */
export function isBracketsAvailableFlag(siteConfig: SiteConfigData | null | undefined): boolean {
  return siteConfig?.bracketsAvailable?.trim().toUpperCase() === 'YES';
}

/**
 * Format the prior-year warning banner from sheet `prior_year_warning_message`.
 * Resolves `<Active Year>` (year being viewed) and `<tournament_year>` (current contest year).
 * Supports `||` line breaks for My Picks rendering.
 *
 * @param template - Message from config
 * @param viewingYear - Year powering the current My Picks view
 * @param tournamentYear - Active contest year from `tournament_year`
 */
export function formatPriorYearWarningMessage(
  template: string | undefined,
  viewingYear: number,
  tournamentYear: number
): string {
  const fallback =
    FALLBACK_CONFIG.priorYearWarningMessage ||
    'You are viewing <Active Year> (read-only). Switch back to <tournament_year> to create or edit picks.';
  const viewing = String(viewingYear);
  const active = String(tournamentYear);
  return (template || fallback)
    .trim()
    .replace(/<Active Year>/gi, viewing)
    .replace(/\{\{Active Year\}\}/gi, viewing)
    .replace(/\{Active Year\}/gi, viewing)
    .replace(/<tournament_year>/gi, active)
    .replace(/\{\{tournament_year\}\}/gi, active)
    .replace(/\{tournament_year\}/gi, active)
    .replace(/\{tournamentYear\}/g, active);
}

/**
 * Evaluate My Picks mutation access and status messaging in priority order:
 * 1. brackets_available = NO → advertising message
 * 2. brackets_available = YES but tournament JSON missing → error message
 * 3. stop_submit_toggle Yes or deadline past → closed message
 * 4. Application Master Lock locked → master_lock_message
 *
 * @param siteConfig - Site config from Sheets
 * @param options.tournamentJsonPresent - Whether `tournament-{year}.json` loaded successfully
 * @param options.masterLockUnlocked - True when Application Master Lock is Unlocked (actions allowed)
 */
export function evaluatePicksAccess(
  siteConfig: SiteConfigData | null | undefined,
  options: {
    tournamentJsonPresent: boolean;
    masterLockUnlocked: boolean;
  }
): PicksAccessResult {
  const config = siteConfig ?? FALLBACK_CONFIG;

  // Priority 1: field not released yet (config-driven, not JSON presence)
  if (!isBracketsAvailableFlag(config)) {
    return {
      blocked: true,
      reasonCode: 'brackets_not_available',
      message: formatBracketsNotAvailableMessage(
        config.bracketsNotAvailableMessage || '',
        {
          dateTimeRaw: config.bracketsAvailableDateTime,
          tournamentYear: config.tournamentYear,
        }
      ),
    };
  }

  // Priority 1b: released in config but JSON missing → error state
  if (!options.tournamentJsonPresent) {
    return {
      blocked: true,
      reasonCode: 'brackets_missing_json',
      message:
        config.bracketsMissingErrorMessage?.trim() ||
        FALLBACK_CONFIG.bracketsMissingErrorMessage ||
        'Bracket field data is missing. Please contact the administrator.',
    };
  }

  // Priority 2: tip-off / force-close via stop_submit_*
  const submissionCheck = checkSubmissionAllowed(config);
  if (!submissionCheck.allowed) {
    return {
      blocked: true,
      reasonCode: 'submission_closed',
      message:
        submissionCheck.reason ||
        config.finalMessageSubmitOff ||
        FALLBACK_CONFIG.finalMessageSubmitOff ||
        'Bracket changes are currently disabled.',
    };
  }

  // Priority 3: Application Master Lock
  if (!options.masterLockUnlocked) {
    return {
      blocked: true,
      reasonCode: 'master_lock',
      message:
        config.masterLockMessage?.trim() ||
        FALLBACK_CONFIG.masterLockMessage ||
        'Bracket actions are temporarily locked by the administrator.',
    };
  }

  return {
    blocked: false,
    reasonCode: 'none',
    message: '',
  };
}
