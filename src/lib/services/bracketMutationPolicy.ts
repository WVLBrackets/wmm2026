import type { SiteConfigData } from '@/lib/siteConfig';
import { getActiveTournamentYear, isHistoricalYear } from '@/lib/services/tournamentYearService';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { evaluatePicksAccess } from '@/lib/services/picksAccessPolicy';
import { tryLoadTournamentData } from '@/lib/tournamentLoader';
import { getMasterLockState } from '@/lib/killSwitch';

export type BracketMutationDenial = {
  allowed: false;
  status: number;
  error: string;
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
 * Priority (current year only; prior years always denied):
 * 1. brackets_available + JSON presence (via picksAccessPolicy)
 * 2. stop_submit toggle / deadline
 * 3. Application Master Lock
 *
 * @param bracketYear - Year stamped on the bracket (or active year for creates)
 */
export async function evaluateBracketMutationAccess(
  bracketYear: number
): Promise<BracketMutationDecision> {
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
    };
  }

  return { allowed: true, activeYear, siteConfig };
}
