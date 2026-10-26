import type {
  TournamentBracket,
  TournamentData,
  TournamentGame,
} from '@/types/tournament';
import {
  getAllBracketGames,
  updateBracketWithPicks,
} from '@/lib/bracketGenerator';

/** Expected games in a full 64-team bracket (60 regional + 2 FF + championship). */
export const FULL_BRACKET_GAME_COUNT = 63;

/**
 * True when the stored pick for this game is still one of the two teams
 * currently slotted into the matchup (rejects orphan / invalidated picks).
 */
export function gamePickIsValid(
  game: TournamentGame | undefined,
  picks: Record<string, string>,
): boolean {
  if (!game?.id) return false;
  const picked = picks[game.id];
  if (!picked) return false;
  return game.team1?.id === picked || game.team2?.id === picked;
}

/**
 * Winning team object when the pick is still valid for this game.
 */
function validWinnerTeam(
  game: TournamentGame | undefined,
  picks: Record<string, string>,
) {
  if (!game || !gamePickIsValid(game, picks)) return undefined;
  const picked = picks[game.id];
  return game.team1?.id === picked ? game.team1 : game.team2;
}

/**
 * Bracket structure with teams filled from picks, then only valid winners advance
 * into the championship slots (orphan Final Four keys do not populate the title game).
 */
export function updateBracketWithValidPicks(
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData,
): TournamentBracket {
  const updated = updateBracketWithPicks(baseBracket, picks, tournamentData);
  updated.championship.team1 = validWinnerTeam(updated.finalFour[0], picks);
  updated.championship.team2 = validWinnerTeam(updated.finalFour[1], picks);
  return updated;
}

/**
 * Count picks that remain valid against the live matchup tree (orphans excluded).
 */
export function countValidBracketPicks(
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData,
): { completed: number; total: number; percentage: number } {
  const updated = updateBracketWithValidPicks(baseBracket, picks, tournamentData);
  const games = getAllBracketGames(updated);
  const total = games.length > 0 ? games.length : FULL_BRACKET_GAME_COUNT;
  const completed = games.filter((game) => gamePickIsValid(game, picks)).length;
  return {
    completed,
    total,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  };
}

/**
 * Champion team id only when the championship pick is still a finalist.
 */
export function getValidChampionId(
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData,
): string | null {
  const updated = updateBracketWithValidPicks(baseBracket, picks, tournamentData);
  if (!gamePickIsValid(updated.championship, picks)) return null;
  return picks[updated.championship.id] || null;
}

/**
 * Drop orphan picks that no longer match their game’s current teams.
 * Safe to run before Save so WIP cannot persist invalidated winners.
 */
export function pruneInvalidPicks(
  baseBracket: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData,
): Record<string, string> {
  const updated = updateBracketWithValidPicks(baseBracket, picks, tournamentData);
  const next: Record<string, string> = {};
  for (const game of getAllBracketGames(updated)) {
    const picked = picks[game.id];
    if (picked && gamePickIsValid(game, picks)) {
      next[game.id] = picked;
    }
  }
  return next;
}
