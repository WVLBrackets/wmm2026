import type { TournamentData, TournamentBracket } from '@/types/tournament';
import type { SiteConfigData } from '@/lib/siteConfig';
import {
  gamePickIsValid,
  updateBracketWithValidPicks,
} from '@/lib/bracketPickValidity';

/**
 * Builds the same per-step completion check used by {@link StepByStepBracket} for progress dots / Next.
 * Uses the live matchup tree so orphan picks (e.g. a champ no longer in the final) do not count.
 */
function buildIsStepComplete(
  regions: TournamentData['regions'],
  liveBracket: TournamentBracket,
  picks: Record<string, string>
) {
  return (step: number): boolean => {
    if (step < regions.length) {
      const region = regions[step];
      const regionGames = liveBracket.regions[region.position] || [];
      const totalGames = 15;
      const completedGames = regionGames.filter((game) =>
        gamePickIsValid(game, picks),
      ).length;
      return completedGames === totalGames;
    }
    const finalFourGames = liveBracket.finalFour;
    const finalFourCompleted = finalFourGames.filter((game) =>
      gamePickIsValid(game, picks),
    ).length;
    const championshipCompleted = gamePickIsValid(liveBracket.championship, picks)
      ? 1
      : 0;
    const totalGames = finalFourGames.length + 1;
    return finalFourCompleted + championshipCompleted === totalGames;
  };
}

/**
 * Whether the bracket satisfies the same readiness rules as the in-editor Submit button’s `canProceed`
 * on the Final Four step (all regions + FF/championship picks, valid tie breaker, non-empty entry name).
 */
export function computeCanProceedToSubmit(
  tournamentData: TournamentData,
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  entryName: string,
  tieBreaker: string,
  siteConfig: SiteConfigData | null | undefined
): boolean {
  const regions = tournamentData.regions;
  const liveBracket = updateBracketWithValidPicks(
    baseBracket,
    picks,
    tournamentData,
  );
  const isStepComplete = buildIsStepComplete(regions, liveBracket, picks);
  const allRegionsComplete = regions.every((region) => isStepComplete(regions.indexOf(region)));
  const finalFourComplete = isStepComplete(regions.length);
  const low = siteConfig?.tieBreakerLow ?? 50;
  const high = siteConfig?.tieBreakerHigh ?? 500;
  const tieBreakerValid = Boolean(
    tieBreaker &&
      !Number.isNaN(Number(tieBreaker)) &&
      Number(tieBreaker) >= low &&
      Number(tieBreaker) <= high
  );
  const entryNameValid = entryName.trim().length > 0;
  return allRegionsComplete && finalFourComplete && tieBreakerValid && entryNameValid;
}

/**
 * First human-readable barrier when {@link computeCanProceedToSubmit} is false (aligned with bracket editor messaging).
 */
export function getBracketSubmitReadinessHint(
  tournamentData: TournamentData,
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  entryName: string,
  tieBreaker: string,
  siteConfig: SiteConfigData | null | undefined
): string {
  const regions = tournamentData.regions;
  const liveBracket = updateBracketWithValidPicks(
    baseBracket,
    picks,
    tournamentData,
  );
  const isStepComplete = buildIsStepComplete(regions, liveBracket, picks);
  const allRegionsComplete = regions.every((region) => isStepComplete(regions.indexOf(region)));
  if (!allRegionsComplete) {
    return (
      siteConfig?.finalMessageTeamsMissing || 'Please select winners for all games in every region.'
    );
  }
  const finalFourComplete = isStepComplete(regions.length);
  if (!finalFourComplete) {
    return (
      siteConfig?.finalMessageTeamsMissing ||
      'Please select winners for all Final Four and Championship games.'
    );
  }
  if (!entryName.trim()) {
    return 'Please enter an entry name before submitting.';
  }
  const low = siteConfig?.tieBreakerLow ?? 50;
  const high = siteConfig?.tieBreakerHigh ?? 500;
  if (!tieBreaker.trim()) {
    return siteConfig?.finalMessageTieBreakerMissing || 'Please enter a tie breaker value.';
  }
  const n = Number(tieBreaker);
  if (Number.isNaN(n) || n < low || n > high) {
    const template =
      siteConfig?.finalMessageTieBreakerInvalid || 'Tie breaker must be between {low} and {high}.';
    return template.replace(/{low}/g, String(low)).replace(/{high}/g, String(high));
  }
  return 'Complete your bracket before submitting.';
}

/**
 * Duplicate entry name vs submitted brackets only (same rule as Final Four submit UI).
 */
export function isSubmitDuplicateEntryName(
  entryName: string,
  siteConfig: SiteConfigData | null | undefined,
  existingSubmittedEntryNames: string[]
): boolean {
  const trimmed = entryName?.trim() || '';
  if (!trimmed || !siteConfig?.tournamentYear) return false;
  return existingSubmittedEntryNames.some((name) => name === trimmed);
}

/**
 * True when submissions are turned off globally (toggle or deadline), matching Final Four editor rules.
 */
export function isBracketSubmissionClosed(siteConfig: SiteConfigData | null | undefined): boolean {
  if (siteConfig?.stopSubmitToggle === 'Yes') return true;
  if (siteConfig?.stopSubmitDateTime) {
    try {
      const deadline = new Date(siteConfig.stopSubmitDateTime);
      if (!Number.isNaN(deadline.getTime()) && Date.now() >= deadline.getTime()) {
        return true;
      }
    } catch {
      /* ignore invalid date */
    }
  }
  return false;
}

/**
 * User-facing reason submissions are closed (empty string if not closed).
 */
export function getBracketSubmissionClosedMessage(
  siteConfig: SiteConfigData | null | undefined
): string {
  if (siteConfig?.stopSubmitToggle === 'Yes') {
    return siteConfig?.finalMessageSubmitOff || 'Bracket submissions are currently disabled.';
  }
  if (siteConfig?.stopSubmitDateTime) {
    try {
      const deadline = new Date(siteConfig.stopSubmitDateTime);
      if (!Number.isNaN(deadline.getTime()) && Date.now() >= deadline.getTime()) {
        return siteConfig?.finalMessageTooLate || 'Bracket submissions are closed. The deadline has passed.';
      }
    } catch {
      /* ignore */
    }
  }
  return '';
}
