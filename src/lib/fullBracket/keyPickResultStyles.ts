/**
 * Compare a user's bracket picks to the official KEY bracket for read-only full-canvas styling
 * (green/red correct/incorrect for played games; blue/red for future games vs eliminated teams).
 */

import type { TournamentBracket, TournamentData } from '@/types/tournament';
import { getAllBracketGames, updateBracketWithPicks } from '@/lib/bracketGenerator';

export type KeyPickResultTone = 'blue' | 'green' | 'red';

/**
 * Collects team IDs that lost in any game the KEY bracket has already decided.
 *
 * @param keyPicks - Official KEY picks (game id → winning team id).
 * @param tournamentData - Tournament structure for resolving slots.
 * @param baseBracket - Empty 64-team bracket shell (see `generate64TeamBracket` in `bracketGenerator`).
 * @returns Set of team ids eliminated per KEY.
 */
export function buildEliminatedTeamIdsFromKeyPicks(
  keyPicks: Record<string, string>,
  tournamentData: TournamentData,
  baseBracket: TournamentBracket
): Set<string> {
  const eliminated = new Set<string>();
  const resolved = updateBracketWithPicks(JSON.parse(JSON.stringify(baseBracket)), keyPicks, tournamentData);
  const games = getAllBracketGames(resolved);

  for (const game of games) {
    const keyWinnerId = keyPicks[game.id]?.trim();
    if (!keyWinnerId || !game.team1?.id || !game.team2?.id) continue;
    const loserId = game.team1.id === keyWinnerId ? game.team2.id : game.team1.id;
    eliminated.add(loserId);
  }

  return eliminated;
}

/**
 * Tone for a team row that **advanced into** the current column because the user picked them
 * to win the feeder game. Compares that advancement to KEY (not the R64/R32 click row).
 *
 * @param feederGameId - Prior-round game whose winner this row represents (e.g. R64 game id for an R32 slot).
 * @param advancedTeamId - Team shown in this row (user’s predicted winner of the feeder game).
 * @param keyPicks - KEY picks; if KEY has decided the feeder, compare `advancedTeamId` to KEY’s winner.
 * @param eliminatedTeamIds - Losers from KEY-decided games; if feeder undecided, red if `advancedTeamId` is eliminated.
 * @returns `green` if KEY matches; `red` if KEY disagrees or team is eliminated; `blue` if still possible.
 */
export function getAdvancementResultTone(
  feederGameId: string,
  advancedTeamId: string,
  keyPicks: Record<string, string>,
  eliminatedTeamIds: Set<string>
): KeyPickResultTone {
  const keyWinner = keyPicks[feederGameId]?.trim();
  if (keyWinner) {
    return advancedTeamId === keyWinner ? 'green' : 'red';
  }
  return eliminatedTeamIds.has(advancedTeamId) ? 'red' : 'blue';
}

/** Canonical championship game id in bracket JSON / picks maps. */
export const CHAMPIONSHIP_PICK_GAME_ID = 'championship';

/**
 * CHAMP row: green/red only after KEY has decided the title game.
 * Never green while `keyPicks.championship` is unset (semifinals alone are not enough).
 */
export function getChampionKeyTone(
  championTeamId: string | undefined,
  keyPicks: Record<string, string>,
  eliminatedTeamIds: Set<string>
): KeyPickResultTone | undefined {
  if (!championTeamId) return undefined;
  const keyChamp = keyPicks[CHAMPIONSHIP_PICK_GAME_ID]?.trim();
  if (keyChamp) {
    return championTeamId === keyChamp ? 'green' : 'red';
  }
  return eliminatedTeamIds.has(championTeamId) ? 'red' : 'blue';
}
