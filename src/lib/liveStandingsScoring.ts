/**
 * Live standings scoring: compare submitted bracket picks to the KEY bracket.
 * Round-of-64 is the first scored round (First Four excluded — not in 63-game tree).
 */

import type { TournamentData, TournamentGame, TournamentTeam } from '@/types/tournament';
import { generate64TeamBracket, updateBracketWithPicks, getAllBracketGames } from '@/lib/bracketGenerator';

/** Base points per round (product spec; not read from tournament JSON metadata). */
const ROUND_BASE_POINTS: Record<string, number> = {
  'Round of 64': 1,
  'Round of 32': 2,
  'Sweet 16': 4,
  'Elite 8': 8,
  'Final Four': 12,
  'Championship': 16,
};

const UNDERDOG_BONUS = 2;

/**
 * Underdog bonus (+2) when the KEY winner’s seed is worse (higher number) than the loser’s.
 */
export function getUnderdogBonusForKeyWinner(
  keyWinner: string,
  t1?: TournamentTeam,
  t2?: TournamentTeam
): number {
  if (!keyWinner || !t1?.id || !t2?.id || typeof t1.seed !== 'number' || typeof t2.seed !== 'number') {
    return 0;
  }
  const winnerTeam = keyWinner === t1.id ? t1 : keyWinner === t2.id ? t2 : null;
  const loserTeam = keyWinner === t1.id ? t2 : keyWinner === t2.id ? t1 : null;
  if (!winnerTeam || !loserTeam || winnerTeam.seed <= loserTeam.seed) {
    return 0;
  }
  return UNDERDOG_BONUS;
}

/**
 * Returns base points for a standard bracket round name.
 */
export function getBasePointsForRound(round: string): number {
  return ROUND_BASE_POINTS[round] ?? 0;
}

/**
 * Score one user's picks against KEY picks using a bracket already resolved with KEY winners
 * (`updateBracketWithPicks` output) so each game has `team1` / `team2` where applicable.
 */
export function scorePicksAgainstKey(
  userPicks: Record<string, string>,
  keyPicks: Record<string, string>,
  keyResolvedGames: TournamentGame[]
): number {
  let total = 0;

  for (const game of keyResolvedGames) {
    const keyWinner = normalizePick(keyPicks[game.id]);
    if (!keyWinner) continue;

    const userPick = normalizePick(userPicks[game.id]);
    if (!userPick || userPick !== keyWinner) continue;

    const base = getBasePointsForRound(game.round);
    total += base;
    total += getUnderdogBonusForKeyWinner(keyWinner, game.team1, game.team2);
  }

  return total;
}

function normalizePick(raw: string | number | undefined | null): string {
  if (raw == null) return '';
  return String(raw).trim();
}

/**
 * Build KEY-resolved games from tournament data + KEY picks JSON.
 */
export function buildKeyResolvedGames(
  tournamentData: TournamentData,
  keyPicks: Record<string, string>
): TournamentGame[] {
  const base = generate64TeamBracket(tournamentData);
  const resolved = updateBracketWithPicks(base, keyPicks, tournamentData);
  return getAllBracketGames(resolved);
}

/**
 * Map every team id in tournament JSON to display name (regions only; advancing teams resolve in-game).
 */
function buildTeamIdToNameMap(tournamentData: TournamentData): Map<string, string> {
  const map = new Map<string, string>();
  for (const region of tournamentData.regions) {
    for (const team of region.teams) {
      map.set(team.id, team.name);
    }
  }
  return map;
}

/**
 * Build one compact audit line per KEY-complete game (KEY has a winner for that game id).
 * Matches {@link scorePicksAgainstKey} for win + underdog points.
 * Format keeps each game on one line: matchup, pick, KEY winner, W/D points.
 */
export function buildLiveScoreDetailLines(
  tournamentData: TournamentData,
  keyPicks: Record<string, string>,
  playerPicks: Record<string, string>
): { lines: string[]; total: number } {
  const keyResolvedGames = buildKeyResolvedGames(tournamentData, keyPicks);
  const nameMap = buildTeamIdToNameMap(tournamentData);
  const lines: string[] = [];
  let total = 0;

  const resolveName = (id: string, t1?: TournamentTeam, t2?: TournamentTeam): string => {
    if (t1?.id === id) return t1.name;
    if (t2?.id === id) return t2.name;
    return nameMap.get(id) ?? id;
  };

  for (const game of keyResolvedGames) {
    const keyWinner = normalizePick(keyPicks[game.id]);
    if (!keyWinner) continue;

    const t1 = game.team1;
    const t2 = game.team2;
    const n1 = t1?.name ?? 'Team 1';
    const n2 = t2?.name ?? 'Team 2';
    const id1 = t1?.id;
    const id2 = t2?.id;
    const matchup = `${n1}-${n2}`;

    const userPick = normalizePick(playerPicks[game.id]);
    let pickCol: string;
    if (!userPick) {
      pickCol = `— ${matchup}`;
    } else if (id1 && userPick === id1) {
      pickCol = `${n1}>${n2}`;
    } else if (id2 && userPick === id2) {
      pickCol = `${n2}>${n1}`;
    } else {
      pickCol = `${resolveName(userPick, t1, t2)} · ${matchup}`;
    }

    const keyWinnerName = resolveName(keyWinner, t1, t2);
    const base = getBasePointsForRound(game.round);
    const correct = Boolean(userPick && userPick === keyWinner);
    const winPts = correct ? base : 0;
    const udPts = correct ? getUnderdogBonusForKeyWinner(keyWinner, t1, t2) : 0;
    const gameTotal = winPts + udPts;
    total += gameTotal;

    lines.push(`P:${pickCol} | K:${keyWinnerName} | W${winPts} D${udPts}`);
  }

  return { lines, total };
}
