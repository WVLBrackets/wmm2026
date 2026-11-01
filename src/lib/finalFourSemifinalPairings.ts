import type { TournamentData, TournamentRegion } from '@/types/tournament';
import { formatCopy } from '@/lib/vintage/copyTree';

/**
 * Formats a Final Four semifinal regional pairing label from the CMS template.
 * @param template - Bracket Editor Messages `finalistPairingLabel` (`{left}`, `{right}`)
 * @param regionA - First feeder region for the semifinal
 * @param regionB - Second feeder region for the semifinal
 */
function formatPairingLabel(
  template: string,
  regionA?: TournamentRegion,
  regionB?: TournamentRegion,
): string {
  const a = regionA?.name?.trim() || '';
  const b = regionB?.name?.trim() || '';
  if (!a || !b) return a || b || '';
  return formatCopy(template, { left: a, right: b }).trim();
}

/**
 * Regional pairing labels for each Final Four semifinal game, aligned with
 * {@link updateBracketWithPicks} / `bracketGenerator` feeder mapping:
 * - `finalFour[0]` <- `regions[0]` vs `regions[1]`
 * - `finalFour[1]` <- `regions[2]` vs `regions[3]`
 *
 * Uses tournament region configuration (array order), not screen position.
 *
 * @param tournamentData - Active tournament definition
 * @param template - CMS pairing template; blank hides the labels
 * @returns Labels indexed like `finalFourGames` (length 2 when four regions exist)
 */
export function getFinalFourSemifinalPairingLabels(
  tournamentData: TournamentData,
  template: string,
): string[] {
  const regions = tournamentData.regions ?? [];
  return [
    formatPairingLabel(template, regions[0], regions[1]),
    formatPairingLabel(template, regions[2], regions[3]),
  ];
}
