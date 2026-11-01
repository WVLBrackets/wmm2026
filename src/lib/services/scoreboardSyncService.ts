/**
 * Sync Scoreboard of Record from Big Balls NCAAB tournament feed.
 *
 * App tournament year 2026 → BBS `season=2025` (season-start year).
 * @see https://bigballsdata.com/docs/ncaab-stats
 */

import {
  fetchBbsTournament,
  isBbsMatchFinished,
  type BbsTournamentMatch,
} from '@/lib/bigBalls/tournamentClient';
import {
  listScoreboardGames,
  listScoreboardTeamMap,
  getScoreboardSettings,
} from '@/lib/repositories/scoreboardRepository';
import {
  defaultBbsSeasonForTourneyYear,
  ensureScoreboardSeeded,
  recordScoreboardSyncResult,
  refreshScoreboardSlotsFromKey,
  shouldRunScoreboardSync,
  upsertScoreboardGameAndApply,
} from '@/lib/services/scoreboardService';
import { getKeyBracketByYear } from '@/lib/repositories/bracketRepository';
import { rebuildScoreboardSnapshot } from '@/lib/services/publicScoreboardService';
import type { ScoreboardGame, ScoreboardGamePatch } from '@/lib/types/scoreboard';

export type ScoreboardSyncSummary = {
  ran: boolean;
  reason?: string;
  season: string;
  /** Men's games seen in the feed. */
  seen: number;
  finishedSeen: number;
  liveSeen: number;
  scheduledSeen: number;
  updated: number;
  applied: number;
  skippedLocked: number;
  unmatched: number;
  unmatchedSamples: string[];
  errors: string[];
};

/** Common school nicknames → our bracket display forms. */
const TEAM_NAME_ALIASES: Record<string, string> = {
  uconn: 'connecticut',
  connecticut: 'connecticut',
  'uconn huskies': 'connecticut',
  'miami florida': 'miami',
  'miami fl': 'miami',
  'st johns': 'st john s',
  'saint johns': 'st john s',
  mcneese: 'mcneese state',
  'mcneese state': 'mcneese state',
  'prairie view': 'prairie view a m',
  'prairie view a m': 'prairie view a m',
  'miami oh': 'miami oh',
  'miami ohio': 'miami oh',
};

/**
 * Normalize a team name for fuzzy fallback matching.
 *
 * @param name - Display name
 */
export function normalizeTeamName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\buniversity of\b/g, ' ')
    .replace(/\b(university|univ|college|the)\b/g, ' ')
    .replace(/\bof\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return TEAM_NAME_ALIASES[base] || base;
}

/**
 * Resolve BBS winner onto our team id when scores / winner flags are present.
 */
function resolveWinnerOurId(
  match: BbsTournamentMatch,
  team1Id: string,
  team2Id: string,
  team1IsHome: boolean,
): string | null {
  if (match.homeWinner === true) {
    return team1IsHome ? team1Id : team2Id;
  }
  if (match.awayWinner === true) {
    return team1IsHome ? team2Id : team1Id;
  }
  if (match.homeScore == null || match.awayScore == null) return null;
  if (match.homeScore === match.awayScore) return null;
  const homeWon = match.homeScore > match.awayScore;
  if (homeWon) return team1IsHome ? team1Id : team2Id;
  return team1IsHome ? team2Id : team1Id;
}

/**
 * Map a BBS match onto a scoreboard game via team ids or unique name pair.
 *
 * @param match - BBS match
 * @param games - Our scoreboard rows
 * @param bbsToOur - Map bbs_team_id → our_team_id
 */
export function matchBbsToScoreboardGame(
  match: BbsTournamentMatch,
  games: ScoreboardGame[],
  bbsToOur: Map<string, string>,
): { gameKey: string; winnerOurId: string | null; team1IsHome: boolean } | null {
  const homeOur = match.homeTeamId ? bbsToOur.get(match.homeTeamId) : undefined;
  const awayOur = match.awayTeamId ? bbsToOur.get(match.awayTeamId) : undefined;

  if (homeOur && awayOur) {
    const byIds = games.find((g) => {
      if (!g.team1Id || !g.team2Id) return false;
      return (
        (g.team1Id === homeOur && g.team2Id === awayOur) ||
        (g.team1Id === awayOur && g.team2Id === homeOur)
      );
    });
    if (byIds && byIds.team1Id && byIds.team2Id) {
      const team1IsHome = byIds.team1Id === homeOur;
      return {
        gameKey: byIds.gameKey,
        winnerOurId: resolveWinnerOurId(
          match,
          byIds.team1Id,
          byIds.team2Id,
          team1IsHome,
        ),
        team1IsHome,
      };
    }
  }

  const homeN = match.homeName ? normalizeTeamName(match.homeName) : '';
  const awayN = match.awayName ? normalizeTeamName(match.awayName) : '';
  if (!homeN || !awayN) return null;

  const candidates = games.filter((g) => {
    if (!g.team1Name || !g.team2Name) return false;
    const a = normalizeTeamName(g.team1Name);
    const b = normalizeTeamName(g.team2Name);
    return (a === homeN && b === awayN) || (a === awayN && b === homeN);
  });
  if (candidates.length !== 1) return null;
  const g = candidates[0];
  if (!g.team1Id || !g.team2Id || !g.team1Name || !g.team2Name) return null;
  const team1IsHome = normalizeTeamName(g.team1Name) === homeN;
  return {
    gameKey: g.gameKey,
    winnerOurId: resolveWinnerOurId(match, g.team1Id, g.team2Id, team1IsHome),
    team1IsHome,
  };
}

/**
 * Build the scoreboard patch for one BBS match (tipoff + status-appropriate fields).
 */
export function patchFromBbsMatch(
  match: BbsTournamentMatch,
  mapped: { team1IsHome: boolean; winnerOurId: string | null },
): ScoreboardGamePatch {
  const patch: ScoreboardGamePatch = {
    bbsMatchId: match.matchId,
    bbsHomeTeamId: match.homeTeamId,
    bbsAwayTeamId: match.awayTeamId,
  };
  if (match.tipoffAt) patch.tipoffAt = match.tipoffAt;

  const score1 = mapped.team1IsHome ? match.homeScore : match.awayScore;
  const score2 = mapped.team1IsHome ? match.awayScore : match.homeScore;

  if (isBbsMatchFinished(match.rawStatus, match.statusState)) {
    patch.status = 'final';
    if (score1 != null) patch.score1 = score1;
    if (score2 != null) patch.score2 = score2;
    if (mapped.winnerOurId) patch.winnerId = mapped.winnerOurId;
    patch.clock = null;
    return patch;
  }

  if (match.status === 'live') {
    patch.status = 'live';
    if (score1 != null) patch.score1 = score1;
    if (score2 != null) patch.score2 = score2;
    if (match.periodLabel) patch.periodLabel = match.periodLabel;
    if (match.clock) patch.clock = match.clock;
    patch.winnerId = null;
    return patch;
  }

  // Scheduled / upcoming — tipoff (+ ids) only; never downgrade live/final status.
  return patch;
}

/**
 * Run BBS → scoreboard sync for a tournament year (e.g. 2026).
 *
 * @param year - Tournament year (March Madness calendar year)
 * @param actorUserId - User id for KEY writes (system admin)
 * @param force - Bypass kill switch / interval (manual Sync now)
 */
export async function syncScoreboardFromBbs(
  year: number,
  actorUserId: string,
  force = false,
): Promise<ScoreboardSyncSummary> {
  const gate = await shouldRunScoreboardSync(year, force);
  const settings = gate.settings;
  const season =
    settings.bbsSeason?.trim() || defaultBbsSeasonForTourneyYear(year);

  const empty = (extra: Partial<ScoreboardSyncSummary> = {}): ScoreboardSyncSummary => ({
    ran: false,
    season,
    seen: 0,
    finishedSeen: 0,
    liveSeen: 0,
    scheduledSeen: 0,
    updated: 0,
    applied: 0,
    skippedLocked: 0,
    unmatched: 0,
    unmatchedSamples: [],
    errors: [],
    ...extra,
  });

  if (!gate.ok) {
    return empty({ reason: gate.reason });
  }

  try {
    await ensureScoreboardSeeded(year);
    // When KEY already has winners (re-sync / historical year), advance blank
    // later-round slots so BBS name matching can find Round of 32+.
    const key = await getKeyBracketByYear(year);
    if (key?.picks && Object.keys(key.picks).length > 0) {
      await refreshScoreboardSlotsFromKey(year, key.picks);
    }
    let games = await listScoreboardGames(year);
    const teamMap = await listScoreboardTeamMap();
    const bbsToOur = new Map(teamMap.map((r) => [r.bbsTeamId, r.ourTeamId]));

    const matches = await fetchBbsTournament(season);
    // Men's draw only (gender on current feed; draw on legacy).
    const mens = matches.filter(
      (m) =>
        !m.draw ||
        m.draw === 'men' ||
        m.draw === 'mens' ||
        m.draw === "men's",
    );

    let finishedSeen = 0;
    let liveSeen = 0;
    let scheduledSeen = 0;
    let updated = 0;
    let applied = 0;
    let skippedLocked = 0;
    let unmatched = 0;
    const unmatchedSamples: string[] = [];
    const errors: string[] = [];

    // Finals first so winners can fill later rounds on subsequent passes.
    const ordered = [...mens].sort((a, b) => {
      const ar = a.round ?? 99;
      const br = b.round ?? 99;
      if (ar !== br) return ar - br;
      return (a.tipoffAt || '').localeCompare(b.tipoffAt || '');
    });

    for (const match of ordered) {
      if (isBbsMatchFinished(match.rawStatus, match.statusState)) {
        finishedSeen += 1;
      } else if (match.status === 'live') {
        liveSeen += 1;
      } else {
        scheduledSeen += 1;
      }

      const mapped = matchBbsToScoreboardGame(match, games, bbsToOur);
      if (!mapped) {
        unmatched += 1;
        if (unmatchedSamples.length < 8) {
          unmatchedSamples.push(
            `${match.homeName ?? '?'} vs ${match.awayName ?? '?'} (${match.matchId})`,
          );
        }
        continue;
      }

      // Skip finals without scores — cannot apply a winner.
      if (
        isBbsMatchFinished(match.rawStatus, match.statusState) &&
        (match.homeScore == null || match.awayScore == null)
      ) {
        continue;
      }

      const patch = patchFromBbsMatch(match, mapped);

      try {
        const result = await upsertScoreboardGameAndApply(
          year,
          mapped.gameKey,
          patch,
          'sync',
          actorUserId,
        );
        if (result.apply?.reason === 'admin_locked') {
          skippedLocked += 1;
          continue;
        }
        updated += 1;
        if (result.apply?.applied) applied += 1;
        if (result.apply && !result.apply.standingsOk && result.apply.reason) {
          errors.push(result.apply.reason);
        }
        // Reload rows when KEY advanced later-round slots (apply) so name match works.
        if (result.apply?.applied) {
          games = await listScoreboardGames(year);
        } else {
          const idx = games.findIndex((g) => g.gameKey === mapped.gameKey);
          if (idx >= 0) games[idx] = result.game;
        }
      } catch (err) {
        errors.push(
          err instanceof Error
            ? err.message
            : `Update failed for ${mapped.gameKey}`,
        );
      }
    }

    try {
      await rebuildScoreboardSnapshot(year);
    } catch (err) {
      errors.push(
        err instanceof Error
          ? `Snapshot rebuild: ${err.message}`
          : 'Snapshot rebuild failed',
      );
    }

    await recordScoreboardSyncResult(
      year,
      errors.length ? 'partial_error' : 'ok',
      errors.length ? errors.slice(0, 3).join('; ') : null,
    );

    return {
      ran: true,
      season,
      seen: mens.length,
      finishedSeen,
      liveSeen,
      scheduledSeen,
      updated,
      applied,
      skippedLocked,
      unmatched,
      unmatchedSamples,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordScoreboardSyncResult(year, 'error', message);
    return empty({ ran: true, errors: [message] });
  }
}

/**
 * Resolve season string currently configured for a year (for UI).
 */
export async function resolveBbsSeason(year: number): Promise<string> {
  const settings = await getScoreboardSettings(year);
  return settings.bbsSeason?.trim() || defaultBbsSeasonForTourneyYear(year);
}
