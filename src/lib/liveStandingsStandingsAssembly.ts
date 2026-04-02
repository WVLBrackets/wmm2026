/**
 * Build {@link StandingsData} for Live Standings from the KEY bracket and submitted pool brackets
 * (same shape as Daily sheet-driven data, different source for KEY row + scoring).
 */

import { generate64TeamBracket, updateBracketWithPicks } from '@/lib/bracketGenerator';
import {
  buildKeyResolvedGames,
  scorePicksAgainstKey,
} from '@/lib/liveStandingsScoring';
import type { BracketWithUser } from '@/lib/types/database';
import type { StandingsData, StandingsEntry, RegionalChampionKeyRow } from '@/lib/standingsData';
import { sortAndRankStandingsEntries } from '@/lib/standingsData';
import type { TournamentBracket, TournamentData } from '@/types/tournament';

function teamNameById(tournamentData: TournamentData, teamId: string): string {
  const t = tournamentData.regions.flatMap((r) => r.teams).find((x) => x.id === teamId);
  return t?.name ?? '';
}

function elite8WinnerName(
  updated: TournamentBracket,
  picks: Record<string, string>,
  tournamentData: TournamentData,
  regionIndex: number
): string {
  const pos = tournamentData.regions[regionIndex].position;
  const games = updated.regions[pos] ?? [];
  const elite8 = games.find((g) => g.round === 'Elite 8');
  if (!elite8?.id) return '';
  const wid = picks[elite8.id]?.trim();
  if (!wid) return '';
  return teamNameById(tournamentData, wid);
}

function buildRegionalChampionKeyRow(
  updatedKey: TournamentBracket,
  keyPicks: Record<string, string>,
  tournamentData: TournamentData
): RegionalChampionKeyRow {
  return [
    elite8WinnerName(updatedKey, keyPicks, tournamentData, 0),
    elite8WinnerName(updatedKey, keyPicks, tournamentData, 1),
    elite8WinnerName(updatedKey, keyPicks, tournamentData, 2),
    elite8WinnerName(updatedKey, keyPicks, tournamentData, 3),
  ];
}

function buildSemifinalKeyNames(
  updatedKey: TournamentBracket,
  keyPicks: Record<string, string>,
  tournamentData: TournamentData
): [string, string] {
  const ff = updatedKey.finalFour;
  const a = ff[0]?.id ? teamNameById(tournamentData, keyPicks[ff[0].id] ?? '') : '';
  const b = ff[1]?.id ? teamNameById(tournamentData, keyPicks[ff[1].id] ?? '') : '';
  return [a, b];
}

function buildEliminatedTeamNames(
  tournamentData: TournamentData,
  keyPicks: Record<string, string>
): string[] {
  const keyGames = buildKeyResolvedGames(tournamentData, keyPicks);
  const out = new Set<string>();
  for (const game of keyGames) {
    const w = keyPicks[game.id]?.trim();
    if (!w || !game.team1?.id || !game.team2?.id) continue;
    const loserId = w === game.team1.id ? game.team2.id : w === game.team2.id ? game.team1.id : null;
    if (!loserId) continue;
    const name = teamNameById(tournamentData, loserId);
    if (name) out.add(name);
  }
  return Array.from(out);
}

function isKeyTieBreakerActive(tieBreaker: number | undefined | null): boolean {
  if (tieBreaker == null) return false;
  const n = Number(tieBreaker);
  return Number.isFinite(n) && n !== 0;
}

/**
 * Assemble full {@link StandingsData} for the live snapshot (KEY-sourced metadata + per-row picks).
 */
export function assembleLiveStandingsData(
  tournamentData: TournamentData,
  keyBracket: { id: string; picks: Record<string, string>; tieBreaker?: number | null },
  submitted: BracketWithUser[],
  computedAtIso: string
): StandingsData {
  const keyPicks = keyBracket.picks || {};
  const base = generate64TeamBracket(tournamentData);
  const updatedKey = updateBracketWithPicks(base, keyPicks, tournamentData);
  const keyGames = buildKeyResolvedGames(tournamentData, keyPicks);

  const regionalChampionKey = buildRegionalChampionKeyRow(updatedKey, keyPicks, tournamentData);
  const semifinalKey = buildSemifinalKeyNames(updatedKey, keyPicks, tournamentData);
  const finalWinner = updatedKey.championship?.id
    ? teamNameById(tournamentData, keyPicks[updatedKey.championship.id] ?? '')
    : '';
  const eliminatedTeams = buildEliminatedTeamNames(tournamentData, keyPicks);
  const keyTieBreakerPopulated = isKeyTieBreakerActive(keyBracket.tieBreaker ?? undefined);
  const keyTbActual = Number(keyBracket.tieBreaker ?? 0) || 0;

  const quarterfinalWinners = regionalChampionKey.filter((t) => t !== '');

  const rawEntries: StandingsEntry[] = submitted.map((b) => {
    const userPicks = b.picks || {};
    const updatedUser = updateBracketWithPicks(base, userPicks, tournamentData);

    const finalFour: string[] = [
      elite8WinnerName(updatedUser, userPicks, tournamentData, 0),
      elite8WinnerName(updatedUser, userPicks, tournamentData, 1),
      elite8WinnerName(updatedUser, userPicks, tournamentData, 2),
      elite8WinnerName(updatedUser, userPicks, tournamentData, 3),
    ];

    const ffGames = updatedUser.finalFour;
    const finals: string[] = [
      ffGames[0]?.id && userPicks[ffGames[0].id]
        ? teamNameById(tournamentData, userPicks[ffGames[0].id]!)
        : '',
      ffGames[1]?.id && userPicks[ffGames[1].id]
        ? teamNameById(tournamentData, userPicks[ffGames[1].id]!)
        : '',
    ];

    const champId = updatedUser.championship?.id ? userPicks[updatedUser.championship.id] : '';
    const champion = champId ? teamNameById(tournamentData, champId) : '';

    const points = scorePicksAgainstKey(userPicks, keyPicks, keyGames);

    const userTb = Number(b.tieBreaker ?? 0) || 0;
    const tbDiff =
      keyTieBreakerPopulated && Number.isFinite(userTb) ? Math.abs(userTb - keyTbActual) : 0;

    return {
      rank: 0,
      player: b.entryName?.trim() || `Bracket ${b.bracketNumber}`,
      points,
      tbDiff,
      finalFour,
      finals,
      champion,
      tb: userTb,
      paid: false,
      bracketId: b.id,
    };
  });

  const ranked = sortAndRankStandingsEntries(rawEntries, keyTieBreakerPopulated);

  return {
    day: 'Live',
    entries: ranked,
    lastUpdated: computedAtIso,
    sheetLastModified: computedAtIso,
    quarterfinalWinners,
    regionalChampionKey,
    semifinalWinners: semifinalKey.filter((t) => t !== ''),
    semifinalKey,
    finalWinner,
    eliminatedTeams,
    keyTieBreakerPopulated,
  };
}
