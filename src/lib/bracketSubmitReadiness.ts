import type { TournamentData, TournamentBracket } from '@/types/tournament';
import {
  gamePickIsValid,
  updateBracketWithValidPicks,
} from '@/lib/bracketPickValidity';
import {
  formatTieBreakerInvalid,
  type VintageBracketEditorContent,
} from '@/lib/vintage/bracketEditorContent';

type TieBreakerRange = Pick<VintageBracketEditorContent, 'tieBreakerLow' | 'tieBreakerHigh'>;

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
 * True when `tieBreaker` is an integer string inside the CMS range.
 *
 * @param tieBreaker - Raw input
 * @param range - Published tie-breaker bounds
 */
export function isTieBreakerInRange(tieBreaker: string, range: TieBreakerRange): boolean {
  if (!tieBreaker) return false;
  const value = Number(tieBreaker);
  return !Number.isNaN(value) && value >= range.tieBreakerLow && value <= range.tieBreakerHigh;
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
  range: TieBreakerRange
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
  return (
    allRegionsComplete &&
    finalFourComplete &&
    isTieBreakerInRange(tieBreaker, range) &&
    entryName.trim().length > 0
  );
}

/**
 * First human-readable barrier when {@link computeCanProceedToSubmit} is false (Bracket Editor Messages CMS).
 */
export function getBracketSubmitReadinessHint(
  tournamentData: TournamentData,
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  entryName: string,
  tieBreaker: string,
  copy: VintageBracketEditorContent
): string {
  const regions = tournamentData.regions;
  const liveBracket = updateBracketWithValidPicks(
    baseBracket,
    picks,
    tournamentData,
  );
  const isStepComplete = buildIsStepComplete(regions, liveBracket, picks);
  const allRegionsComplete = regions.every((region) => isStepComplete(regions.indexOf(region)));
  if (!allRegionsComplete || !isStepComplete(regions.length)) {
    return copy.teamsMissingMessage;
  }
  if (!entryName.trim()) return copy.entryNameMissingMessage;
  if (!tieBreaker.trim()) return copy.tieBreakerMissingMessage;
  if (!isTieBreakerInRange(tieBreaker, copy)) return formatTieBreakerInvalid(copy);
  return copy.completeBeforeSubmitMessage;
}

/**
 * Duplicate entry name vs submitted brackets only (same rule as Final Four submit UI).
 *
 * @param entryName - Current entry name
 * @param existingSubmittedEntryNames - Names of the user's other submitted brackets
 */
export function isSubmitDuplicateEntryName(
  entryName: string,
  existingSubmittedEntryNames: string[]
): boolean {
  const trimmed = entryName?.trim() || '';
  if (!trimmed) return false;
  return existingSubmittedEntryNames.some((name) => name === trimmed);
}
