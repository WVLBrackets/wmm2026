/**
 * Public Scoreboard — pool-facing board; admin finals also update KEY / standings.
 */

import { getLogoUrlSync } from '@/lib/teamLogos';
import {
  assignGameToPageIfUnassigned,
  getScoreboardGame,
  insertScoreboardPageIfAbsent,
  listAllPageGameAssignments,
  listScoreboardGames,
  listScoreboardPages,
  moveGameToPage,
  setPageGameKeys,
  updateScoreboardPage,
} from '@/lib/repositories/scoreboardRepository';
import {
  getScoreboardSnapshot,
  upsertScoreboardSnapshot,
} from '@/lib/repositories/scoreboardSnapshotRepository';
import {
  ensureHistoricalPlayInGames,
  ensureScoreboardSeeded,
  upsertScoreboardGameAndApply,
  type ApplyFinalResult,
} from '@/lib/services/scoreboardService';
import { formatScoreboardDateLabel } from '@/lib/scoreboardDateLabel';
import { bucketR64ByTipoffDay } from '@/lib/scoreboardR64DayBuckets';
import { SYNTHETIC_TEAM_LOGO_IDS } from '@/lib/scoreboardHistoricalPlayIn';
import {
  partitionScoreboardSections,
  sortFinalGames,
  sortGamesChronologically,
  sortLiveGames,
  sortUpcomingGames,
} from '@/lib/scoreboardSort';
import { addCombinedPlayInLogos } from '@/lib/tournamentLogosServer';
import { loadTournamentData } from '@/lib/tournamentLoaderServer';
import type { ScoreboardGame, ScoreboardGamePatch } from '@/lib/types/scoreboard';

export {
  partitionScoreboardSections,
  sortFinalGames,
  sortGamesChronologically,
  sortLiveGames,
  sortUpcomingGames,
} from '@/lib/scoreboardSort';
import {
  DEFAULT_SCOREBOARD_PAGES,
  type PublicScoreboardGame,
  type PublicScoreboardPageSummary,
  type PublicScoreboardPayload,
  type ScoreboardPage,
  type ScoreboardPageSlice,
  type ScoreboardYearSnapshot,
} from '@/lib/types/publicScoreboard';

const SUBTITLE = 'Follow the tournament, one game at a time.';

/**
 * Ensure default grouping pages exist for a year.
 */
export async function ensureScoreboardPages(year: number): Promise<ScoreboardPage[]> {
  const existing = await listScoreboardPages(year);
  if (existing.length > 0) return existing;
  for (const p of DEFAULT_SCOREBOARD_PAGES) {
    await insertScoreboardPageIfAbsent(year, p);
  }
  return listScoreboardPages(year);
}

/**
 * Assign Round of 64 games to Day 1 / Day 2 by Eastern tipoff calendar day.
 * Day 1 = earliest tipped day (e.g. 3/19); Day 2 = the next day (e.g. 3/20).
 * Untipped games stay on Day 2 until sync fills tips (or on Day 1 if Day 2 is empty).
 *
 * @param year - Tournament year
 * @param r64 - Round of 64 scoreboard rows
 */
async function assignR64PagesByTipoffDay(
  year: number,
  r64: Array<{ gameKey: string; tipoffAt: Date | string | null | undefined }>,
): Promise<void> {
  const { day1Keys, day2Keys, unscheduledKeys } = bucketR64ByTipoffDay(r64);
  const day1 = [...day1Keys];
  const day2 = [...day2Keys];
  if (day1.length > 0) {
    day2.push(...unscheduledKeys);
  } else {
    // No tipped days yet — keep a stable provisional split until tipoffs sync.
    const provisional = [...r64]
      .map((g) => g.gameKey)
      .sort((a, b) => a.localeCompare(b));
    const mid = Math.ceil(provisional.length / 2);
    day1.push(...provisional.slice(0, mid));
    day2.push(...provisional.slice(mid));
  }
  await setPageGameKeys(year, 'round-1-day-1', day1);
  await setPageGameKeys(year, 'round-1-day-2', day2);
}

/**
 * Bootstrap page↔game assignments from round labels when none exist yet.
 * Round of 64 Day 1 / Day 2 always follow Eastern tipoff calendar days when tips exist
 * (reassigns sticky half-by-key rows from older bootstraps).
 */
export async function ensureDefaultPageAssignments(year: number): Promise<void> {
  const [pages, games, assignments] = await Promise.all([
    listScoreboardPages(year),
    listScoreboardGames(year),
    listAllPageGameAssignments(year),
  ]);

  if (games.length === 0) {
    await ensureScoreboardSeeded(year);
  } else {
    // Even when bracket rows exist, ensure hard-coded historical play-ins.
    await ensureHistoricalPlayInGames(year);
  }
  if (pages.length === 0) {
    await ensureScoreboardPages(year);
  }

  const seededGames = await listScoreboardGames(year);
  const firstFour = seededGames.filter((g) => g.kind === 'first_four');
  const r64 = seededGames.filter((g) => g.roundLabel === 'Round of 64');

  // Always (re)assign First Four onto Play In when historical rows appear later.
  if (assignments.length > 0) {
    let order = assignments.filter((a) => a.pageSlug === 'play-in').length;
    for (const g of firstFour) {
      await assignGameToPageIfUnassigned(year, 'play-in', g.gameKey, order++);
    }
    // Fix R64 Day 1/Day 2 whenever tipoffs are known (overrides legacy half-by-key split).
    if (r64.some((g) => g.tipoffAt)) {
      await assignR64PagesByTipoffDay(year, r64);
    }
    return;
  }
  const r32 = seededGames.filter((g) => g.roundLabel === 'Round of 32');
  const s16 = seededGames.filter((g) => g.roundLabel === 'Sweet 16');
  const e8 = seededGames.filter((g) => g.roundLabel === 'Elite 8');
  const finalFour = seededGames.filter((g) => g.roundLabel === 'Final Four');
  const championship = seededGames.filter(
    (g) => g.roundLabel === 'Championship' || g.gameKey === 'championship',
  );

  let order = 0;
  for (const g of firstFour) {
    await assignGameToPageIfUnassigned(year, 'play-in', g.gameKey, order++);
  }
  await assignR64PagesByTipoffDay(year, r64);
  order = 0;
  for (const g of r32) {
    await assignGameToPageIfUnassigned(year, 'round-2', g.gameKey, order++);
  }
  order = 0;
  for (const g of [...s16, ...e8]) {
    await assignGameToPageIfUnassigned(year, 'rounds-3-4', g.gameKey, order++);
  }
  order = 0;
  for (const g of finalFour) {
    await assignGameToPageIfUnassigned(year, 'final-four', g.gameKey, order++);
  }
  order = 0;
  for (const g of championship) {
    await assignGameToPageIfUnassigned(year, 'championship', g.gameKey, order++);
  }
}

/**
 * Ensure Championship ribbon page exists and owns the title game
 * (older seeds put Championship on Final Four).
 */
export async function ensureChampionshipPageSplit(year: number): Promise<void> {
  await ensureScoreboardPages(year);
  const champDef = DEFAULT_SCOREBOARD_PAGES.find((p) => p.slug === 'championship');
  if (champDef) {
    await insertScoreboardPageIfAbsent(year, champDef);
  }
  const games = await listScoreboardGames(year);
  const championshipGames = games.filter(
    (g) => g.roundLabel === 'Championship' || g.gameKey === 'championship',
  );
  let order = 0;
  for (const g of championshipGames) {
    await moveGameToPage(year, 'championship', g.gameKey, order++);
  }
}

/**
 * True when id is a First Four / play-in slot (not a real ESPN team id).
 */
export function isPlayInSlotTeamId(teamId: string | null | undefined): boolean {
  return Boolean(teamId && teamId.startsWith('playin:'));
}

/**
 * Build teamId → logo URL map for a year (includes combined play-in tiles).
 * Avoids `/logos/teams/playin:….png` 404s.
 */
export async function buildScoreboardLogoMap(
  year: number,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const raw = await loadTournamentData(String(year));
    const data = await addCombinedPlayInLogos(raw);
    for (const region of data.regions) {
      for (const team of region.teams) {
        if (team.logo) map.set(team.id, team.logo);
        if (!team.playIn?.teams) continue;
        for (const school of team.playIn.teams) {
          if (school.logo) {
            map.set(school.id, school.logo);
          } else if (school.id && !isPlayInSlotTeamId(school.id)) {
            map.set(school.id, getLogoUrlSync(school.id));
          }
        }
      }
    }
  } catch (error) {
    console.warn('[scoreboard] logo map unavailable', error);
  }
  // Synthetic First Four / resolved-slot ids → real ESPN PNG paths.
  for (const [syntheticId, espnId] of Object.entries(SYNTHETIC_TEAM_LOGO_IDS)) {
    map.set(syntheticId, getLogoUrlSync(espnId));
  }
  return map;
}

/**
 * Resolve a logo URL: tournament map first, then ESPN file path for real ids.
 */
export function resolveScoreboardLogoUrl(
  teamId: string | null,
  logoMap: Map<string, string>,
): string | null {
  if (!teamId) return null;
  const mapped = logoMap.get(teamId);
  if (mapped) {
    // Prefer ESPN file when a synthetic slot still points at a missing 500x PNG.
    const aliasId = SYNTHETIC_TEAM_LOGO_IDS[teamId];
    if (aliasId && mapped.includes(`/logos/teams/${teamId}.`)) {
      return getLogoUrlSync(aliasId);
    }
    return mapped;
  }
  if (isPlayInSlotTeamId(teamId)) return null;
  const aliasId = SYNTHETIC_TEAM_LOGO_IDS[teamId];
  if (aliasId) return getLogoUrlSync(aliasId);
  return getLogoUrlSync(teamId);
}

export {
  buildRegionNameMap,
  resolveRegionDisplayName,
} from '@/lib/scoreboardRegion';
import {
  buildRegionNameMap,
  resolveRegionDisplayName,
} from '@/lib/scoreboardRegion';

/**
 * Map DB game → public card (no secrets).
 */
export function toPublicGame(
  g: ScoreboardGame,
  logoMap: Map<string, string> = new Map(),
  regionNameByKey: Map<string, string> = new Map(),
): PublicScoreboardGame {
  return {
    gameKey: g.gameKey,
    kind: g.kind,
    roundLabel: g.roundLabel,
    region: resolveRegionDisplayName(g.region, regionNameByKey),
    seed1: g.seed1,
    seed2: g.seed2,
    team1Id: g.team1Id,
    team2Id: g.team2Id,
    team1Name: g.team1Name,
    team2Name: g.team2Name,
    team1LogoUrl: resolveScoreboardLogoUrl(g.team1Id, logoMap),
    team2LogoUrl: resolveScoreboardLogoUrl(g.team2Id, logoMap),
    status: g.status,
    score1: g.score1,
    score2: g.score2,
    winnerId: g.winnerId,
    tipoffAt: g.tipoffAt ? g.tipoffAt.toISOString() : null,
    periodLabel: g.periodLabel,
    clock: g.clock,
    statusNote: g.statusNote,
    updatedAt: g.updatedAt.toISOString(),
  };
}

function toPageSummary(
  page: ScoreboardPage,
  gameCount: number,
): PublicScoreboardPageSummary {
  return {
    slug: page.slug,
    label: page.label,
    sortOrder: page.sortOrder,
    desktopCols: page.desktopCols,
    mobileCols: page.mobileCols,
    gameCount,
  };
}

/**
 * Empty year snapshot used when none has been published yet (instant public load).
 */
export function emptyScoreboardYearSnapshot(year: number): ScoreboardYearSnapshot {
  const pages: PublicScoreboardPageSummary[] = DEFAULT_SCOREBOARD_PAGES.map(
    (p) => ({
      slug: p.slug,
      label: p.label,
      sortOrder: p.sortOrder,
      desktopCols: p.desktopCols,
      mobileCols: p.mobileCols,
      gameCount: 0,
    }),
  );
  const bySlug: Record<string, ScoreboardPageSlice> = {};
  for (const p of pages) {
    bySlug[p.slug] = { live: [], upcoming: [], completed: [] };
  }
  return {
    year,
    subtitle: SUBTITLE,
    pages,
    bySlug,
    lastUpdatedAt: null,
    computedAt: new Date(0).toISOString(),
  };
}

/**
 * Normalize a snapshot page slice (supports legacy liveUpcoming blobs).
 */
export function normalizeScoreboardPageSlice(raw: unknown): ScoreboardPageSlice {
  const empty: ScoreboardPageSlice = { live: [], upcoming: [], completed: [] };
  if (!raw || typeof raw !== 'object') return empty;
  const row = raw as Record<string, unknown>;
  const completed = Array.isArray(row.completed)
    ? (row.completed as PublicScoreboardGame[])
    : [];

  if (Array.isArray(row.live) && Array.isArray(row.upcoming)) {
    return {
      live: sortLiveGames(row.live as PublicScoreboardGame[]),
      upcoming: sortUpcomingGames(row.upcoming as PublicScoreboardGame[]),
      completed: sortFinalGames(completed),
    };
  }

  const legacy = Array.isArray(row.liveUpcoming)
    ? (row.liveUpcoming as PublicScoreboardGame[])
    : [];
  return {
    live: sortLiveGames(legacy.filter((g) => g.status === 'live')),
    upcoming: sortUpcomingGames(legacy.filter((g) => g.status === 'scheduled')),
    completed: sortFinalGames(completed),
  };
}

/**
 * Slice a year snapshot into the one-page public payload.
 */
export function sliceScoreboardSnapshot(
  snap: ScoreboardYearSnapshot,
  slug?: string | null,
): PublicScoreboardPayload {
  const active =
    snap.pages.find((p) => p.slug === slug) ||
    snap.pages[0] || {
      slug: 'play-in',
      label: 'Play In',
      sortOrder: 10,
      desktopCols: 2,
      mobileCols: 1,
      gameCount: 0,
    };
  const slice = normalizeScoreboardPageSlice(snap.bySlug[active.slug]);
  const dateLabel = formatScoreboardDateLabel([
    ...slice.live.map((g) => g.tipoffAt),
    ...slice.upcoming.map((g) => g.tipoffAt),
    ...slice.completed.map((g) => g.tipoffAt),
  ]);
  return {
    year: snap.year,
    pages: snap.pages,
    page: active,
    live: slice.live,
    upcoming: slice.upcoming,
    completed: slice.completed,
    lastUpdatedAt: snap.lastUpdatedAt || snap.computedAt,
    subtitle: snap.subtitle || SUBTITLE,
    dateLabel,
  };
}

/**
 * Heavy rebuild from operational tables → year snapshot blob.
 * Call only from admin save / explicit rebuild — never on visitor page load.
 */
export async function buildScoreboardYearSnapshot(
  year: number,
): Promise<ScoreboardYearSnapshot> {
  await ensureDefaultPageAssignments(year);
  await ensureChampionshipPageSplit(year);

  let regionNameByKey = new Map<string, string>();
  try {
    const tournamentData = await loadTournamentData(String(year));
    regionNameByKey = buildRegionNameMap(tournamentData.regions || []);
  } catch (error) {
    console.warn('[scoreboard] region name map unavailable', error);
  }

  const [pages, games, assignments, logoMap] = await Promise.all([
    listScoreboardPages(year),
    listScoreboardGames(year),
    listAllPageGameAssignments(year),
    buildScoreboardLogoMap(year),
  ]);
  const byKey = new Map(games.map((g) => [g.gameKey, g]));

  const counts = new Map<string, number>();
  for (const a of assignments) {
    counts.set(a.pageSlug, (counts.get(a.pageSlug) || 0) + 1);
  }

  // Ribbon order follows DEFAULT_SCOREBOARD_PAGES sortOrder (Final Four before Championship).
  const summaries = [...pages]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
    .map((p) => toPageSummary(p, counts.get(p.slug) || 0));
  const bySlug: Record<string, ScoreboardPageSlice> = {};
  let lastUpdatedAt: string | null = null;

  for (const page of summaries) {
    const pageKeys = assignments
      .filter((a) => a.pageSlug === page.slug)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.gameKey.localeCompare(b.gameKey),
      )
      .map((a) => a.gameKey);
    const pageGames = pageKeys
      .map((k) => byKey.get(k))
      .filter((g): g is ScoreboardGame => Boolean(g));

    for (const g of pageGames) {
      const iso = g.updatedAt.toISOString();
      if (!lastUpdatedAt || iso > lastUpdatedAt) lastUpdatedAt = iso;
    }

    const parts = partitionScoreboardSections(pageGames);
    bySlug[page.slug] = {
      live: parts.live.map((g) => toPublicGame(g, logoMap, regionNameByKey)),
      upcoming: parts.upcoming.map((g) =>
        toPublicGame(g, logoMap, regionNameByKey),
      ),
      completed: parts.completed.map((g) =>
        toPublicGame(g, logoMap, regionNameByKey),
      ),
    };
  }

  return {
    year,
    subtitle: SUBTITLE,
    pages: summaries,
    bySlug,
    lastUpdatedAt,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Rebuild and persist the public snapshot (admin path).
 */
export async function rebuildScoreboardSnapshot(
  year: number,
): Promise<ScoreboardYearSnapshot> {
  const snap = await buildScoreboardYearSnapshot(year);
  await upsertScoreboardSnapshot(year, snap);
  return snap;
}

/**
 * Public read: one snapshot row, then in-memory slug slice.
 * Does not seed, query games tables, or rebuild logos.
 *
 * @param year - Tournament year
 * @param slug - Page slug; falls back to first page when missing
 */
export async function getPublicScoreboard(
  year: number,
  slug?: string | null,
): Promise<PublicScoreboardPayload> {
  try {
    const snap =
      (await getScoreboardSnapshot(year)) || emptyScoreboardYearSnapshot(year);
    return sliceScoreboardSnapshot(snap, slug);
  } catch (error) {
    console.error('[getPublicScoreboard] snapshot read failed; empty board', error);
    return sliceScoreboardSnapshot(emptyScoreboardYearSnapshot(year), slug);
  }
}

/**
 * Admin update for a public scoreboard game.
 * Newly final games flow through {@link upsertScoreboardGameAndApply}
 * (KEY picks, First Four tourney results, championship TB, standings recompute).
 */
export async function updatePublicScoreboardGame(
  year: number,
  gameKey: string,
  patch: ScoreboardGamePatch,
  actorUserId: string,
): Promise<{ game: ScoreboardGame; apply: ApplyFinalResult | null }> {
  const existing = await getScoreboardGame(year, gameKey);
  if (!existing) {
    throw new Error(`Unknown scoreboard game: ${gameKey}`);
  }
  if (
    patch.winnerId &&
    existing.team1Id &&
    existing.team2Id &&
    patch.winnerId !== existing.team1Id &&
    patch.winnerId !== existing.team2Id
  ) {
    throw new Error('Winner must be one of the two teams');
  }
  return upsertScoreboardGameAndApply(
    year,
    gameKey,
    { ...patch, adminLocked: true },
    'admin',
    actorUserId,
  );
}

/**
 * Publish many game patches in one admin action (single snapshot rebuild after).
 */
export async function publishPublicScoreboardGames(
  year: number,
  games: Array<{ gameKey: string; patch: ScoreboardGamePatch }>,
  actorUserId: string,
): Promise<{
  results: Array<{ gameKey: string; apply: ApplyFinalResult | null }>;
}> {
  const results: Array<{ gameKey: string; apply: ApplyFinalResult | null }> = [];
  for (const row of games) {
    const result = await updatePublicScoreboardGame(
      year,
      row.gameKey,
      row.patch,
      actorUserId,
    );
    results.push({ gameKey: row.gameKey, apply: result.apply });
  }
  return { results };
}

/**
 * Update page density / label / order.
 */
export async function updatePublicScoreboardPage(
  year: number,
  slug: string,
  patch: {
    label?: string;
    sortOrder?: number;
    desktopCols?: number;
    mobileCols?: number;
  },
): Promise<ScoreboardPage> {
  const updated = await updateScoreboardPage(year, slug, patch);
  if (!updated) throw new Error(`Unknown scoreboard page: ${slug}`);
  return updated;
}

/**
 * Replace assigned games for a page (admin).
 */
export async function replacePageGames(
  year: number,
  slug: string,
  gameKeys: string[],
): Promise<void> {
  const pages = await listScoreboardPages(year);
  if (!pages.some((p) => p.slug === slug)) {
    throw new Error(`Unknown scoreboard page: ${slug}`);
  }
  await setPageGameKeys(year, slug, gameKeys);
}
