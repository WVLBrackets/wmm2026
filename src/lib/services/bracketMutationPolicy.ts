import type { SiteConfigData } from '@/lib/siteConfig';
import { getActiveTournamentYear, isHistoricalYear } from '@/lib/services/tournamentYearService';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { evaluatePicksAccess } from '@/lib/services/picksAccessPolicy';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import { getMasterLockState } from '@/lib/killSwitch';
import { vintageAdminEmail } from '@/lib/vintage/admin';
import type { VintageActionKind } from '@/lib/services/vintageActionLock';
import { evaluateVintageActionLockFresh } from '@/lib/services/vintageActionLockServer';
import { getPublishedVintageContent } from '@/lib/vintage/store';
import { getPublishedVintagePicksContent } from '@/lib/vintage/picksStore';

export type BracketMutationDenial = {
  allowed: false;
  status: number;
  error: string;
  reasonCode?: string;
};

export type BracketMutationAllowance = {
  allowed: true;
  activeYear: number;
  siteConfig: SiteConfigData | null;
};

export type BracketMutationDecision = BracketMutationDenial | BracketMutationAllowance;

/**
 * Load fresh site config for mutation gates, falling back to FALLBACK_CONFIG.
 */
async function loadSiteConfigForMutation(): Promise<SiteConfigData | null> {
  try {
    return await getSiteConfigFromGoogleSheetsFresh();
  } catch (error) {
    console.warn('[bracketMutationPolicy] Site config fetch failed; using fallback.', error);
    return FALLBACK_CONFIG;
  }
}

/**
 * Decide whether a create/update/delete mutation is allowed for a bracket year.
 *
 * Vintage (primary admin): Action Lock master reference — tipoff, published,
 * master lock, prior year; Save WIP allowed when only tipoff/master would block.
 * Legacy: Config Sheet brackets_available / stop_submit / master lock.
 *
 * @param bracketYear - Year stamped on the bracket (DB). For creates, pass any
 *   hint; with `forCreate: true` vintage always evaluates against Active Tourney Year.
 * @param action - `changing` (default) or `save_wip` (in-progress persist)
 * @param options.forCreate - When true, vintage ignores sheet year drift and uses CMS active year
 */
export async function evaluateBracketMutationAccess(
  bracketYear: number,
  action: VintageActionKind = 'changing',
  options?: { forCreate?: boolean },
): Promise<BracketMutationDecision> {
  const isVintageAdmin = Boolean(await vintageAdminEmail());

  if (isVintageAdmin) {
    const [home, picksCopy] = await Promise.all([
      getPublishedVintageContent(),
      getPublishedVintagePicksContent(),
    ]);
    const activeYear = parseInt(String(home.tournament.year).trim(), 10);
    if (Number.isNaN(activeYear)) {
      return {
        allowed: false,
        status: 500,
        error: 'Active Tourney Year is not configured on the homepage.',
        reasonCode: 'brackets_missing_json',
      };
    }
    const yearForLock = options?.forCreate ? activeYear : bracketYear;
    const lock = await evaluateVintageActionLockFresh({
      action,
      bracketYear: yearForLock,
      home,
      picksCopy,
    });
    if (lock.blocked) {
      return {
        allowed: false,
        status: 403,
        error: lock.message,
        reasonCode: lock.reasonCode,
      };
    }
    return {
      allowed: true,
      activeYear: lock.activeYear,
      siteConfig: {
        ...FALLBACK_CONFIG,
        tournamentYear: String(lock.activeYear),
        bracketsAvailable: 'YES',
        stopSubmitToggle: 'No',
        stopSubmitDateTime: '',
        entryCost: lock.picksCopy.entryCost,
        bracketsMissingErrorMessage: lock.picksCopy.bracketsMissingErrorMessage,
        masterLockMessage: lock.picksCopy.masterLockMessage,
        priorYearWarningMessage: lock.picksCopy.priorYearWarningMessage,
        finalMessageSubmitOff: lock.picksCopy.tourneyActiveMessage,
      },
    };
  }

  // Legacy path ignores save_wip distinction for stop_submit (sheet still gates all).
  const siteConfig = await loadSiteConfigForMutation();
  const activeYear = siteConfig?.tournamentYear
    ? parseInt(String(siteConfig.tournamentYear), 10)
    : await getActiveTournamentYear();

  if (Number.isNaN(activeYear)) {
    return {
      allowed: false,
      status: 500,
      error: 'Tournament year is not configured.',
    };
  }

  if (isHistoricalYear(bracketYear, activeYear)) {
    return {
      allowed: false,
      status: 403,
      error: `Brackets from ${bracketYear} are read-only. Only ${activeYear} brackets can be modified.`,
      reasonCode: 'prior_year',
    };
  }

  const tournamentData = await tryLoadTournamentData(String(activeYear));
  const masterLock = await getMasterLockState();
  const access = evaluatePicksAccess(siteConfig, {
    tournamentJsonPresent: Boolean(tournamentData),
    masterLockUnlocked: masterLock.unlocked,
  });

  if (access.blocked) {
    return {
      allowed: false,
      status: 403,
      error: access.message,
      reasonCode: access.reasonCode,
    };
  }

  return { allowed: true, activeYear, siteConfig };
}
