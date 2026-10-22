/**
 * Vintage My Picks action-lock evaluator (master reference) — client-safe pure logic.
 *
 * Changing actions are blocked when any criterion is met. Message priority:
 * 1) prior year  2) brackets not available  3) missing JSON (error)
 * 4) tourney active (tipoff)  5) master lock
 *
 * Save WIP is allowed on the active year when only tipoff and/or master lock
 * would block Changing (so mid-session users are not stranded).
 *
 * Server APIs that need fresh CMS + admin email use
 * `evaluateVintageActionLockFresh` from `vintageActionLockServer.ts`.
 */

import { isHistoricalYear } from '@/lib/services/tournamentYearService';
import {
  formatVintageBracketsNotPublishedMessage,
  formatVintagePicksLabel,
  type VintagePicksContent,
} from '@/lib/vintage/picksContent';

export type VintageActionLockReason =
  | 'prior_year'
  | 'brackets_not_available'
  | 'brackets_missing_json'
  | 'tourney_active'
  | 'master_lock'
  | 'none';

/** Changing mutations vs in-progress save escape hatch vs viewing. */
export type VintageActionKind = 'changing' | 'save_wip' | 'viewing';

export type VintageActionLockResult = {
  blocked: boolean;
  reasonCode: VintageActionLockReason;
  message: string;
};

export type VintageActionLockInput = {
  action: VintageActionKind;
  bracketYear: number;
  activeYear: number;
  picksCopy: VintagePicksContent;
  /** Homepage tipoff ISO (with tz). */
  tipoffAt: string;
  /** Used only for not-published `{date}` token (Ready, else tipoff). */
  bracketsReadyAt?: string;
  tournamentJsonPresent: boolean;
  /** Defaults to Date.now(); pass server time on the client when available. */
  nowMs?: number;
};

/**
 * True when now is at or past homepage tipoff (entries closed / tourney active).
 */
export function isVintageTourneyActive(
  tipoffAt: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  const raw = tipoffAt?.trim() ?? '';
  if (!raw) return false;
  const tip = Date.parse(raw);
  if (!Number.isFinite(tip)) return false;
  return nowMs >= tip;
}

/**
 * Format prior-year Changing lock / banner message from My Picks CMS.
 */
export function formatVintagePriorYearMessage(
  picksCopy: VintagePicksContent,
  viewingYear: number,
  activeYear: number,
): string {
  return formatVintagePicksLabel(picksCopy.priorYearWarningMessage, {
    year: viewingYear,
    activeYear,
  })
    .replace(/<Active Year>/gi, String(viewingYear))
    .replace(/\{\{Active Year\}\}/gi, String(viewingYear))
    .replace(/\{Active Year\}/gi, String(viewingYear))
    .replace(/<tournament_year>/gi, String(activeYear))
    .replace(/\{\{tournament_year\}\}/gi, String(activeYear))
    .replace(/\{tournament_year\}/gi, String(activeYear));
}

/**
 * Evaluate vintage Changing / Save WIP / Viewing access (pure; no I/O).
 */
export function evaluateVintageActionLock(
  input: VintageActionLockInput,
): VintageActionLockResult {
  const {
    action,
    bracketYear,
    activeYear,
    picksCopy,
    tipoffAt,
    bracketsReadyAt,
    tournamentJsonPresent,
    nowMs = Date.now(),
  } = input;

  if (action === 'viewing') {
    return { blocked: false, reasonCode: 'none', message: '' };
  }

  const yearToken = activeYear;

  // 1) Prior year
  if (isHistoricalYear(bracketYear, activeYear)) {
    return {
      blocked: true,
      reasonCode: 'prior_year',
      message: formatVintagePriorYearMessage(picksCopy, bracketYear, activeYear),
    };
  }

  // 2) Brackets not available (admin checkbox)
  if (!picksCopy.bracketsPublished) {
    return {
      blocked: true,
      reasonCode: 'brackets_not_available',
      message: formatVintageBracketsNotPublishedMessage(
        picksCopy.bracketsNotPublishedMessage,
        {
          year: yearToken,
          tipoffAt: bracketsReadyAt || tipoffAt,
        },
      ),
    };
  }

  // 3) Published but JSON missing — error state (not a soft lock message)
  if (!tournamentJsonPresent) {
    return {
      blocked: true,
      reasonCode: 'brackets_missing_json',
      message: formatVintagePicksLabel(picksCopy.bracketsMissingErrorMessage, {
        year: yearToken,
      }),
    };
  }

  const tipoffClosed = isVintageTourneyActive(tipoffAt, nowMs);
  const masterLocked = !picksCopy.masterLockUnlocked;

  // Save WIP: allow when only tipoff and/or master lock would block Changing
  if (action === 'save_wip') {
    return { blocked: false, reasonCode: 'none', message: '' };
  }

  // 4) Tourney active (tipoff passed)
  if (tipoffClosed) {
    return {
      blocked: true,
      reasonCode: 'tourney_active',
      message: formatVintagePicksLabel(picksCopy.tourneyActiveMessage, {
        year: yearToken,
      }),
    };
  }

  // 5) Master Lock
  if (masterLocked) {
    return {
      blocked: true,
      reasonCode: 'master_lock',
      message: formatVintagePicksLabel(picksCopy.masterLockMessage, {
        year: yearToken,
      }),
    };
  }

  return { blocked: false, reasonCode: 'none', message: '' };
}

/**
 * Whether Save should stay enabled in the editor when Changing is blocked.
 */
export function vintageSaveWipAllowedWhileLocked(
  reasonCode: VintageActionLockReason,
): boolean {
  return reasonCode === 'tourney_active' || reasonCode === 'master_lock';
}
