/**
 * Scoreboard of Record — seed, apply finals to KEY / First Four, standings refresh.
 */

import {
  generate64TeamBracket,
  getAllBracketGames,
  updateBracketWithPicks,
} from '@/lib/bracketGenerator';
import { recomputeLiveStandingsAfterKeySave } from '@/lib/liveStandingsService';
import {
  getKeyBracketByYear,
  getOrCreateKeyBracket,
  updateBracket,
} from '@/lib/repositories/bracketRepository';
import {
  getScoreboardGame,
  getScoreboardSettings,
  insertScoreboardGameIfAbsent,
  listScoreboardGames,
  updateScoreboardGame,
  updateScoreboardSettings,
} from '@/lib/repositories/scoreboardRepository';
import {
  getTournamentWorkspace,
  saveTournamentWorkspace,
} from '@/lib/repositories/tournamentRepository';
import { loadTournamentData } from '@/lib/tournamentLoaderServer';
import { historicalPlayInForYear } from '@/lib/scoreboardHistoricalPlayIn';
import type {
  ScoreboardGame,
  ScoreboardGamePatch,
  ScoreboardGameSource,
} from '@/lib/types/scoreboard';
import { KEY_LOCK_TIMEOUT_MINUTES } from '@/lib/repositories/bracketRepository';

/**
 * Seed hard-coded First Four rows for years whose field JSON omitted play-ins.
 * Safe to call repeatedly; skips admin-locked rows.
 *
 * @param year - Tournament year
 * @returns Number of play-in rows written/refreshed
 */
export async function ensureHistoricalPlayInGames(
  year: number,
): Promise<number> {
  const seeds = historicalPlayInForYear(year);
  if (seeds.length === 0) return 0;

  let written = 0;
  for (const g of seeds) {
    await insertScoreboardGameIfAbsent(year, {
      gameKey: g.gameKey,
      kind: 'first_four',
      roundLabel: 'First Four',
      region: g.region,
      seed1: g.seed,
      seed2: g.seed,
      team1Id: g.team1Id,
      team2Id: g.team2Id,
      team1Name: g.team1Name,
      team2Name: g.team2Name,
    });
    const row = await getScoreboardGame(year, g.gameKey);
    if (!row || row.adminLocked) continue;
    await updateScoreboardGame(
      year,
      g.gameKey,
      {
        kind: 'first_four',
        roundLabel: 'First Four',
        region: g.region,
        seed1: g.seed,
        seed2: g.seed,
        team1Id: g.team1Id,
        team2Id: g.team2Id,
        team1Name: g.team1Name,
        team2Name: g.team2Name,
        status: 'final',
        score1: g.score1,
        score2: g.score2,
        winnerId: g.winnerId,
        tipoffAt: g.tipoffAt,
      },
      'seed',
      null,
    );
    written += 1;
  }
  return written;
}

export type ApplyFinalResult = {
  applied: boolean;
  reason?: string;
  keyUpdated: boolean;
  firstFourUpdated: boolean;
  /** Championship combined score written to KEY tieBreaker. */
  tieBreakerUpdated: boolean;
  standingsOk: boolean;
};

/**
 * Combined championship score used as KEY tie-breaker when the title game goes final.
 */
export function championshipTieBreakerFromScores(
  score1: number | null | undefined,
  score2: number | null | undefined,
): number | null {
  if (typeof score1 !== 'number' || typeof score2 !== 'number') return null;
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) return null;
  return score1 + score2;
}

/**
 * True when a scoreboard write should push into KEY / First Four / standings.
 * Newly final, winner change, or championship score change (tie-breaker).
 */
export function shouldApplyScoreboardFinalToOfficial(
  before: Pick<
    ScoreboardGame,
    'status' | 'winnerId' | 'score1' | 'score2' | 'gameKey'
  >,
  after: Pick<
    ScoreboardGame,
    'status' | 'winnerId' | 'score1' | 'score2' | 'gameKey'
  >,
): boolean {
  if (after.status !== 'final' || !after.winnerId) return false;
  if (before.status !== 'final' || before.winnerId !== after.winnerId) {
    return true;
  }
  if (
    after.gameKey === 'championship' &&
    (before.score1 !== after.score1 || before.score2 !== after.score2)
  ) {
    return true;
  }
  return false;
}

/**
 * Empty apply result for non-final / skipped writes.
 */
function skippedApply(reason: string): ApplyFinalResult {
  return {
    applied: false,
    reason,
    keyUpdated: false,
    firstFourUpdated: false,
    tieBreakerUpdated: false,
    standingsOk: true,
  };
}

/**
 * Refresh non-final scoreboard team slots from KEY-resolved bracket tree.
 * Safe to call when KEY already holds winners but scoreboard later rounds are blank.
 *
 * @param year - Tournament year
 * @param keyPicks - KEY bracket picks (gameKey → winner team id)
 */
export async function refreshScoreboardSlotsFromKey(
  year: number,
  keyPicks: Record<string, string>,
): Promise<void> {
  const tournamentData = await loadTournamentData(String(year));
  const live = updateBracketWithPicks(
    generate64TeamBracket(tournamentData),
    keyPicks,
    tournamentData,
  );
  for (const g of getAllBracketGames(live)) {
    const row = await getScoreboardGame(year, g.id);
    if (!row || row.status === 'final' || row.adminLocked) continue;
    await updateScoreboardGame(
      year,
      g.id,
      {
        team1Id: g.team1?.id ?? null,
        team2Id: g.team2?.id ?? null,
        team1Name: g.team1?.name ?? null,
        team2Name: g.team2?.name ?? null,
        seed1: g.team1?.seed ?? null,
        seed2: g.team2?.seed ?? null,
      },
      'seed',
      null,
    );
  }
}

/**
 * Seed scoreboard rows from published tournament + bracket game ids.
 * Fast path: if any rows exist for the year, skip (no per-request N+1 refresh).
 * Pass `forceRefreshSlots` after First Four / field changes to rewrite non-final matchups.
 *
 * @param year - Tournament year
 * @param options.forceRefreshSlots - Re-copy team slots from the published field
 */
export async function ensureScoreboardSeeded(
  year: number,
  options: { forceRefreshSlots?: boolean } = {},
): Promise<number> {
  const existing = await listScoreboardGames(year);
  if (existing.length > 0 && !options.forceRefreshSlots) {
    await ensureHistoricalPlayInGames(year);
    return 0;
  }

  const tournamentData = await loadTournamentData(String(year));
  const workspace = await getTournamentWorkspace(year);
  let insertedHint = 0;

  // First Four play-in slots — store region *name* for public footers (not Top Left / etc.).
  for (const region of tournamentData.regions) {
    for (const team of region.teams) {
      if (!team.playIn?.teams || team.playIn.teams.length !== 2) continue;
      const [a, b] = team.playIn.teams;
      await insertScoreboardGameIfAbsent(year, {
        gameKey: team.id,
        kind: 'first_four',
        roundLabel: 'First Four',
        region: region.name || region.position,
        seed1: team.seed,
        seed2: team.seed,
        team1Id: a.id,
        team2Id: b.id,
        team1Name: a.name,
        team2Name: b.name,
      });
      insertedHint += 1;
      // Reflect existing FF result if already set
      const winnerId = workspace.results[team.id];
      if (winnerId) {
        const row = await getScoreboardGame(year, team.id);
        if (row && row.status !== 'final') {
          await updateScoreboardGame(
            year,
            team.id,
            { status: 'final', winnerId, adminLocked: false },
            'seed',
            null,
          );
        }
      }
    }
  }

  const regionNameByPosition = new Map(
    tournamentData.regions.map((r) => [r.position, r.name || r.position]),
  );
  const base = generate64TeamBracket(tournamentData);
  const withPicks = updateBracketWithPicks(base, {}, tournamentData);
  const games = getAllBracketGames(withPicks);
  for (const game of games) {
    const regionName = game.region
      ? regionNameByPosition.get(game.region) || game.region
      : null;
    await insertScoreboardGameIfAbsent(year, {
      gameKey: game.id,
      kind: 'bracket',
      roundLabel: game.round,
      region: regionName,
      seed1: game.team1?.seed ?? null,
      seed2: game.team2?.seed ?? null,
      team1Id: game.team1?.id ?? null,
      team2Id: game.team2?.id ?? null,
      team1Name: game.team1?.name ?? null,
      team2Name: game.team2?.name ?? null,
    });
    insertedHint += 1;
  }

  // Slot refresh only on forced reseed (not on every public page view)
  if (options.forceRefreshSlots) {
    const refreshed = updateBracketWithPicks(
      generate64TeamBracket(tournamentData),
      {},
      tournamentData,
    );
    for (const game of getAllBracketGames(refreshed)) {
      const row = await getScoreboardGame(year, game.id);
      if (!row || row.status === 'final' || row.adminLocked) continue;
      if (!game.team1 && !game.team2) continue;
      const regionName = game.region
        ? regionNameByPosition.get(game.region) || game.region
        : null;
      await updateScoreboardGame(
        year,
        game.id,
        {
          team1Id: game.team1?.id ?? null,
          team2Id: game.team2?.id ?? null,
          team1Name: game.team1?.name ?? null,
          team2Name: game.team2?.name ?? null,
          seed1: game.team1?.seed ?? null,
          seed2: game.team2?.seed ?? null,
          roundLabel: game.round,
          region: regionName,
        },
        'seed',
        null,
      );
    }
  }

  await ensureHistoricalPlayInGames(year);
  await getScoreboardSettings(year);
  return insertedHint;
}

/**
 * True when KEY lock is held by someone other than actor (and not stale).
 */
function keyLockedByOther(
  lockUserId: string | null | undefined,
  lockAcquiredAt: Date | null | undefined,
  actorUserId: string,
): boolean {
  if (!lockUserId || lockUserId === actorUserId) return false;
  if (!lockAcquiredAt) return true;
  const age = Date.now() - lockAcquiredAt.getTime();
  return age <= KEY_LOCK_TIMEOUT_MINUTES * 60 * 1000;
}

/**
 * Apply a Final scoreboard game to First Four / KEY / championship TB, then recompute standings.
 * Call only when {@link shouldApplyScoreboardFinalToOfficial} is true (newly final).
 *
 * @param year - Tournament year
 * @param game - Scoreboard row (must be final with winner)
 * @param actorUserId - Admin performing the write (for KEY ownership / lock)
 */
export async function applyFinalToOfficialResults(
  year: number,
  game: ScoreboardGame,
  actorUserId: string,
): Promise<ApplyFinalResult> {
  if (game.status !== 'final' || !game.winnerId) {
    return skippedApply('Game is not final with a winner');
  }

  const winner = game.winnerId;
  if (
    game.team1Id &&
    game.team2Id &&
    winner !== game.team1Id &&
    winner !== game.team2Id
  ) {
    return skippedApply('Winner must be one of the two teams');
  }

  let keyUpdated = false;
  let firstFourUpdated = false;
  let tieBreakerUpdated = false;

  if (game.kind === 'first_four') {
    const workspace = await getTournamentWorkspace(year);
    if (!workspace.published) {
      return skippedApply('No published tournament for First Four results');
    }
    if (workspace.results[game.gameKey] !== winner) {
      const nextResults = { ...workspace.results, [game.gameKey]: winner };
      await saveTournamentWorkspace({
        year,
        revision: workspace.revision,
        actor: actorUserId,
        action: 'results',
        results: nextResults,
      });
      firstFourUpdated = true;
    }
  } else {
    let key = await getKeyBracketByYear(year);
    if (!key) {
      key = await getOrCreateKeyBracket(year, actorUserId);
    }
    if (keyLockedByOther(key.lockUserId, key.lockAcquiredAt, actorUserId)) {
      return skippedApply('KEY is locked by another admin; retry later');
    }

    const picks = { ...(key.picks || {}) };
    const pickChanged = picks[game.gameKey] !== winner;
    if (pickChanged) {
      picks[game.gameKey] = winner;
    }

    const champTb =
      game.gameKey === 'championship'
        ? championshipTieBreakerFromScores(game.score1, game.score2)
        : null;
    const tbChanged =
      champTb != null && Number(key.tieBreaker ?? NaN) !== champTb;

    if (pickChanged || tbChanged) {
      const updated = await updateBracket(key.id, {
        picks,
        ...(tbChanged ? { tieBreaker: champTb! } : {}),
        status: key.status === 'draft' ? 'in_progress' : key.status,
      });
      if (!updated) {
        return {
          applied: false,
          reason: 'Failed to update KEY picks',
          keyUpdated: false,
          firstFourUpdated: false,
          tieBreakerUpdated: false,
          standingsOk: false,
        };
      }
      keyUpdated = pickChanged;
      tieBreakerUpdated = tbChanged;
      key = updated;
    }
  }

  const officialChanged = keyUpdated || firstFourUpdated || tieBreakerUpdated;

  if (officialChanged) {
    try {
      const keyForSlots = await getKeyBracketByYear(year);
      await refreshScoreboardSlotsFromKey(year, keyForSlots?.picks || {});
    } catch (err) {
      console.error('[applyFinalToOfficialResults] slot refresh failed', err);
    }
  }

  // Standings recompute once per newly applied final (or TB / First Four change).
  if (officialChanged) {
    const keyAfter = await getKeyBracketByYear(year);
    if (keyAfter) {
      const standings = await recomputeLiveStandingsAfterKeySave(
        year,
        keyAfter.id,
      );
      return {
        applied: true,
        keyUpdated,
        firstFourUpdated,
        tieBreakerUpdated,
        standingsOk: standings.ok,
        reason: standings.ok ? undefined : standings.error,
      };
    }
  }

  return {
    applied: officialChanged,
    keyUpdated,
    firstFourUpdated,
    tieBreakerUpdated,
    standingsOk: true,
  };
}

/**
 * Upsert a scoreboard game and apply Final to official results when appropriate.
 *
 * @param year - Tournament year
 * @param gameKey - Internal game key
 * @param patch - Fields to update
 * @param source - admin | sync
 * @param actorUserId - Admin user id
 */
export async function upsertScoreboardGameAndApply(
  year: number,
  gameKey: string,
  patch: ScoreboardGamePatch,
  source: ScoreboardGameSource,
  actorUserId: string,
): Promise<{ game: ScoreboardGame; apply: ApplyFinalResult | null }> {
  const before = await getScoreboardGame(year, gameKey);
  if (!before) {
    throw new Error(`Unknown scoreboard game: ${gameKey}`);
  }

  if (source === 'sync' && before.adminLocked) {
    return {
      game: before,
      apply: skippedApply('admin_locked'),
    };
  }

  const adminPatch: ScoreboardGamePatch =
    source === 'admin'
      ? { ...patch, adminLocked: patch.adminLocked ?? true }
      : patch;

  const game = await updateScoreboardGame(
    year,
    gameKey,
    adminPatch,
    source,
    source === 'admin' ? actorUserId : null,
  );
  if (!game) {
    throw new Error(`Failed to update scoreboard game: ${gameKey}`);
  }

  // Only push KEY / First Four / standings when a game newly goes final (or champ scores change).
  if (shouldApplyScoreboardFinalToOfficial(before, game)) {
    const apply = await applyFinalToOfficialResults(year, game, actorUserId);
    return { game, apply };
  }

  return { game, apply: null };
}

/**
 * Default BBS season label: year the season began (tourney year − 1).
 * Example: app year 2026 (March 2026 Madness) → Big Balls `season=2025`.
 *
 * @param tourneyYear - Calendar year of March Madness
 */
export function defaultBbsSeasonForTourneyYear(tourneyYear: number): string {
  return String(tourneyYear - 1);
}

/**
 * Whether cron/sync should run now based on settings.
 *
 * @param year - Tournament year
 * @param force - Ignore interval (manual Sync now)
 */
export async function shouldRunScoreboardSync(
  year: number,
  force = false,
): Promise<{ ok: boolean; reason?: string; settings: Awaited<ReturnType<typeof getScoreboardSettings>> }> {
  const settings = await getScoreboardSettings(year);
  if (!settings.autoSyncEnabled && !force) {
    return { ok: false, reason: 'auto_sync_disabled', settings };
  }
  if (!force && settings.lastSyncAt) {
    const elapsedMin = (Date.now() - settings.lastSyncAt.getTime()) / 60_000;
    if (elapsedMin < settings.pollIntervalMinutes) {
      return { ok: false, reason: 'interval_not_elapsed', settings };
    }
  }
  return { ok: true, settings };
}

/**
 * List games for admin UI after ensuring seed.
 *
 * @param year - Tournament year
 */
export async function getScoreboardForAdmin(year: number): Promise<{
  games: ScoreboardGame[];
  settings: Awaited<ReturnType<typeof getScoreboardSettings>>;
}> {
  await ensureScoreboardSeeded(year);
  const [games, settings] = await Promise.all([
    listScoreboardGames(year),
    getScoreboardSettings(year),
  ]);
  return { games, settings };
}

/**
 * Persist sync outcome onto settings.
 */
export async function recordScoreboardSyncResult(
  year: number,
  status: string,
  error: string | null = null,
): Promise<void> {
  await updateScoreboardSettings(year, {
    lastSyncAt: new Date(),
    lastSyncStatus: status,
    lastSyncError: error,
  });
}
