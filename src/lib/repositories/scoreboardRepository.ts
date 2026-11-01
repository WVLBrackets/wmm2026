import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { ensureScoreboardTables } from '@/lib/database/migrations';
import type {
  ScoreboardGame,
  ScoreboardGameKind,
  ScoreboardGamePatch,
  ScoreboardGameSource,
  ScoreboardGameStatus,
  ScoreboardSettings,
  ScoreboardTeamMapRow,
} from '@/lib/types/scoreboard';
import type { ScoreboardPage } from '@/lib/types/publicScoreboard';

let scoreboardSchemaReady: Promise<void> | null = null;

/**
 * Ensure scoreboard tables exist (CREATE IF NOT EXISTS). Cached per process.
 * Public snapshot reads stay DDL-free; admin/sync/seed paths call this first.
 */
async function ensureScoreboardSchema(): Promise<void> {
  if (!scoreboardSchemaReady) {
    scoreboardSchemaReady = ensureScoreboardTables().catch((error) => {
      scoreboardSchemaReady = null;
      throw error;
    });
  }
  await scoreboardSchemaReady;
}

/**
 * Map a DB row to ScoreboardGame.
 */
function mapGame(row: Record<string, unknown>): ScoreboardGame {
  return {
    environment: String(row.environment),
    year: Number(row.year),
    gameKey: String(row.game_key),
    kind: (row.kind as ScoreboardGameKind) || 'bracket',
    roundLabel: String(row.round_label ?? ''),
    region: row.region != null ? String(row.region) : null,
    seed1: row.seed1 != null ? Number(row.seed1) : null,
    seed2: row.seed2 != null ? Number(row.seed2) : null,
    team1Id: row.team1_id != null ? String(row.team1_id) : null,
    team2Id: row.team2_id != null ? String(row.team2_id) : null,
    team1Name: row.team1_name != null ? String(row.team1_name) : null,
    team2Name: row.team2_name != null ? String(row.team2_name) : null,
    status: (row.status as ScoreboardGameStatus) || 'scheduled',
    score1: row.score1 != null ? Number(row.score1) : null,
    score2: row.score2 != null ? Number(row.score2) : null,
    winnerId: row.winner_id != null ? String(row.winner_id) : null,
    bbsMatchId: row.bbs_match_id != null ? String(row.bbs_match_id) : null,
    bbsHomeTeamId: row.bbs_home_team_id != null ? String(row.bbs_home_team_id) : null,
    bbsAwayTeamId: row.bbs_away_team_id != null ? String(row.bbs_away_team_id) : null,
    lastSyncedAt: row.last_synced_at ? new Date(String(row.last_synced_at)) : null,
    source: (row.source as ScoreboardGameSource) || 'seed',
    adminLocked: Boolean(row.admin_locked),
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
    tipoffAt: row.tipoff_at ? new Date(String(row.tipoff_at)) : null,
    periodLabel: row.period_label != null ? String(row.period_label) : null,
    clock: row.clock != null ? String(row.clock) : null,
    statusNote: row.status_note != null ? String(row.status_note) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * Map a scoreboard_pages row.
 */
function mapPage(row: Record<string, unknown>): ScoreboardPage {
  return {
    environment: String(row.environment),
    year: Number(row.year),
    slug: String(row.slug),
    label: String(row.label),
    sortOrder: Number(row.sort_order ?? 0),
    desktopCols: Math.min(4, Math.max(1, Number(row.desktop_cols ?? 2))),
    mobileCols: Math.min(2, Math.max(1, Number(row.mobile_cols ?? 1))),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * Parse tipoff patch value to Date | null.
 */
function parseTipoff(value: Date | string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Map settings row.
 */
function mapSettings(row: Record<string, unknown>): ScoreboardSettings {
  return {
    environment: String(row.environment),
    year: Number(row.year),
    autoSyncEnabled: Boolean(row.auto_sync_enabled),
    pollIntervalMinutes: Number(row.poll_interval_minutes ?? 5),
    bbsSeason: row.bbs_season != null ? String(row.bbs_season) : null,
    lastSyncAt: row.last_sync_at ? new Date(String(row.last_sync_at)) : null,
    lastSyncStatus: row.last_sync_status != null ? String(row.last_sync_status) : null,
    lastSyncError: row.last_sync_error != null ? String(row.last_sync_error) : null,
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * Distinct tournament years that already have scoreboard game rows
 * in the current environment (newest first).
 */
export async function listScoreboardYears(): Promise<number[]> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT DISTINCT year
    FROM scoreboard_games
    WHERE environment = ${environment}
    ORDER BY year DESC
  `;
  return result.rows.map((row: Record<string, unknown>) => Number(row.year));
}

/**
 * Ensure the env-level scoreboard app settings row exists (default year, etc.).
 */
async function ensureScoreboardAppSettingsTable(): Promise<void> {
  await ensureScoreboardSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS scoreboard_app_settings (
      environment VARCHAR(50) PRIMARY KEY,
      default_year INTEGER NOT NULL DEFAULT 2026,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Default year for the public Scoreboard year switcher (CMS-controlled).
 */
export async function getScoreboardDefaultYear(
  fallbackYear: number,
): Promise<number> {
  await ensureScoreboardAppSettingsTable();
  const environment = getCurrentEnvironment();
  const existing = await sql`
    SELECT default_year FROM scoreboard_app_settings
    WHERE environment = ${environment}
    LIMIT 1
  `;
  if (existing.rows.length === 0) {
    return fallbackYear;
  }
  const y = Number(existing.rows[0].default_year);
  return Number.isInteger(y) && y >= 2000 && y <= 9999 ? y : fallbackYear;
}

/**
 * Persist the CMS default scoreboard year for this environment.
 *
 * @param defaultYear - Four-digit tournament year
 */
export async function setScoreboardDefaultYear(
  defaultYear: number,
): Promise<number> {
  await ensureScoreboardAppSettingsTable();
  const environment = getCurrentEnvironment();
  await sql`
    INSERT INTO scoreboard_app_settings (environment, default_year, updated_at)
    VALUES (${environment}, ${defaultYear}, NOW())
    ON CONFLICT (environment) DO UPDATE SET
      default_year = EXCLUDED.default_year,
      updated_at = NOW()
  `;
  return defaultYear;
}

/**
 * List all scoreboard games for a year (current environment).
 *
 * @param year - Tournament year
 */
export async function listScoreboardGames(year: number): Promise<ScoreboardGame[]> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT * FROM scoreboard_games
    WHERE environment = ${environment} AND year = ${year}
    ORDER BY
      CASE kind WHEN 'first_four' THEN 0 ELSE 1 END,
      round_label ASC,
      region ASC NULLS LAST,
      game_key ASC
  `;
  return result.rows.map((r: Record<string, unknown>) => mapGame(r));
}

/**
 * Get one scoreboard game.
 *
 * @param year - Tournament year
 * @param gameKey - Internal game key
 */
export async function getScoreboardGame(
  year: number,
  gameKey: string,
): Promise<ScoreboardGame | null> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT * FROM scoreboard_games
    WHERE environment = ${environment} AND year = ${year} AND game_key = ${gameKey}
    LIMIT 1
  `;
  if (result.rows.length === 0) return null;
  return mapGame(result.rows[0] as Record<string, unknown>);
}

/**
 * Insert a seed row if missing (does not overwrite results).
 */
export async function insertScoreboardGameIfAbsent(
  year: number,
  seed: {
    gameKey: string;
    kind: ScoreboardGameKind;
    roundLabel: string;
    region: string | null;
    seed1: number | null;
    seed2: number | null;
    team1Id: string | null;
    team2Id: string | null;
    team1Name: string | null;
    team2Name: string | null;
  },
): Promise<void> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  await sql`
    INSERT INTO scoreboard_games (
      environment, year, game_key, kind, round_label, region,
      seed1, seed2, team1_id, team2_id, team1_name, team2_name,
      status, source
    ) VALUES (
      ${environment}, ${year}, ${seed.gameKey}, ${seed.kind}, ${seed.roundLabel}, ${seed.region},
      ${seed.seed1}, ${seed.seed2}, ${seed.team1Id}, ${seed.team2Id}, ${seed.team1Name}, ${seed.team2Name},
      'scheduled', 'seed'
    )
    ON CONFLICT (environment, year, game_key) DO NOTHING
  `;
}

/**
 * Persist a scoreboard game patch.
 *
 * @param year - Tournament year
 * @param gameKey - Internal game key
 * @param patch - Fields to update
 * @param source - Provenance
 * @param updatedBy - Admin user id when source is admin
 */
export async function updateScoreboardGame(
  year: number,
  gameKey: string,
  patch: ScoreboardGamePatch,
  source: ScoreboardGameSource,
  updatedBy: string | null = null,
): Promise<ScoreboardGame | null> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const current = await getScoreboardGame(year, gameKey);
  if (!current) return null;

  const next = {
    status: patch.status ?? current.status,
    score1: patch.score1 !== undefined ? patch.score1 : current.score1,
    score2: patch.score2 !== undefined ? patch.score2 : current.score2,
    winnerId: patch.winnerId !== undefined ? patch.winnerId : current.winnerId,
    team1Id: patch.team1Id !== undefined ? patch.team1Id : current.team1Id,
    team2Id: patch.team2Id !== undefined ? patch.team2Id : current.team2Id,
    team1Name: patch.team1Name !== undefined ? patch.team1Name : current.team1Name,
    team2Name: patch.team2Name !== undefined ? patch.team2Name : current.team2Name,
    seed1: patch.seed1 !== undefined ? patch.seed1 : current.seed1,
    seed2: patch.seed2 !== undefined ? patch.seed2 : current.seed2,
    roundLabel: patch.roundLabel ?? current.roundLabel,
    region: patch.region !== undefined ? patch.region : current.region,
    kind: patch.kind ?? current.kind,
    bbsMatchId: patch.bbsMatchId !== undefined ? patch.bbsMatchId : current.bbsMatchId,
    bbsHomeTeamId:
      patch.bbsHomeTeamId !== undefined ? patch.bbsHomeTeamId : current.bbsHomeTeamId,
    bbsAwayTeamId:
      patch.bbsAwayTeamId !== undefined ? patch.bbsAwayTeamId : current.bbsAwayTeamId,
    adminLocked:
      patch.adminLocked !== undefined ? patch.adminLocked : current.adminLocked,
    tipoffAt:
      patch.tipoffAt !== undefined
        ? (parseTipoff(patch.tipoffAt) ?? null)
        : current.tipoffAt,
    periodLabel:
      patch.periodLabel !== undefined ? patch.periodLabel : current.periodLabel,
    clock: patch.clock !== undefined ? patch.clock : current.clock,
    statusNote:
      patch.statusNote !== undefined ? patch.statusNote : current.statusNote,
  };

  const lastSyncedAt = source === 'sync' ? new Date() : current.lastSyncedAt;

  const result = await sql`
    UPDATE scoreboard_games SET
      kind = ${next.kind},
      round_label = ${next.roundLabel},
      region = ${next.region},
      seed1 = ${next.seed1},
      seed2 = ${next.seed2},
      team1_id = ${next.team1Id},
      team2_id = ${next.team2Id},
      team1_name = ${next.team1Name},
      team2_name = ${next.team2Name},
      status = ${next.status},
      score1 = ${next.score1},
      score2 = ${next.score2},
      winner_id = ${next.winnerId},
      bbs_match_id = ${next.bbsMatchId},
      bbs_home_team_id = ${next.bbsHomeTeamId},
      bbs_away_team_id = ${next.bbsAwayTeamId},
      last_synced_at = ${lastSyncedAt},
      source = ${source},
      admin_locked = ${next.adminLocked},
      tipoff_at = ${next.tipoffAt},
      period_label = ${next.periodLabel},
      clock = ${next.clock},
      status_note = ${next.statusNote},
      updated_by = ${updatedBy},
      updated_at = NOW()
    WHERE environment = ${environment} AND year = ${year} AND game_key = ${gameKey}
    RETURNING *
  `;
  if (result.rows.length === 0) return null;
  return mapGame(result.rows[0] as Record<string, unknown>);
}

/**
 * Get or create default scoreboard settings for a year.
 *
 * @param year - Tournament year
 */
export async function getScoreboardSettings(year: number): Promise<ScoreboardSettings> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const existing = await sql`
    SELECT * FROM scoreboard_settings
    WHERE environment = ${environment} AND year = ${year}
    LIMIT 1
  `;
  if (existing.rows.length > 0) {
    return mapSettings(existing.rows[0] as Record<string, unknown>);
  }
  await sql`
    INSERT INTO scoreboard_settings (environment, year)
    VALUES (${environment}, ${year})
    ON CONFLICT (environment, year) DO NOTHING
  `;
  const created = await sql`
    SELECT * FROM scoreboard_settings
    WHERE environment = ${environment} AND year = ${year}
    LIMIT 1
  `;
  return mapSettings(created.rows[0] as Record<string, unknown>);
}

/**
 * Update scoreboard sync settings.
 *
 * @param year - Tournament year
 * @param patch - Settings fields
 */
export async function updateScoreboardSettings(
  year: number,
  patch: {
    autoSyncEnabled?: boolean;
    pollIntervalMinutes?: number;
    bbsSeason?: string | null;
    lastSyncAt?: Date | null;
    lastSyncStatus?: string | null;
    lastSyncError?: string | null;
  },
): Promise<ScoreboardSettings> {
  await getScoreboardSettings(year);
  const environment = getCurrentEnvironment();
  const current = await getScoreboardSettings(year);
  const next = {
    autoSyncEnabled:
      patch.autoSyncEnabled !== undefined
        ? patch.autoSyncEnabled
        : current.autoSyncEnabled,
    pollIntervalMinutes:
      patch.pollIntervalMinutes !== undefined
        ? Math.min(120, Math.max(1, Math.round(patch.pollIntervalMinutes)))
        : current.pollIntervalMinutes,
    bbsSeason: patch.bbsSeason !== undefined ? patch.bbsSeason : current.bbsSeason,
    lastSyncAt: patch.lastSyncAt !== undefined ? patch.lastSyncAt : current.lastSyncAt,
    lastSyncStatus:
      patch.lastSyncStatus !== undefined ? patch.lastSyncStatus : current.lastSyncStatus,
    lastSyncError:
      patch.lastSyncError !== undefined ? patch.lastSyncError : current.lastSyncError,
  };
  const result = await sql`
    UPDATE scoreboard_settings SET
      auto_sync_enabled = ${next.autoSyncEnabled},
      poll_interval_minutes = ${next.pollIntervalMinutes},
      bbs_season = ${next.bbsSeason},
      last_sync_at = ${next.lastSyncAt},
      last_sync_status = ${next.lastSyncStatus},
      last_sync_error = ${next.lastSyncError},
      updated_at = NOW()
    WHERE environment = ${environment} AND year = ${year}
    RETURNING *
  `;
  return mapSettings(result.rows[0] as Record<string, unknown>);
}

/**
 * List BBS ↔ our team id mappings for the current environment.
 */
export async function listScoreboardTeamMap(): Promise<ScoreboardTeamMapRow[]> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT * FROM scoreboard_team_map
    WHERE environment = ${environment}
    ORDER BY our_team_id ASC
  `;
  return result.rows.map((row: Record<string, unknown>) => ({
    environment: String(row.environment),
    ourTeamId: String(row.our_team_id),
    bbsTeamId: String(row.bbs_team_id),
    bbsTeamName: row.bbs_team_name != null ? String(row.bbs_team_name) : null,
    updatedAt: new Date(String(row.updated_at)),
  }));
}

/**
 * Upsert a team id mapping.
 *
 * @param ourTeamId - WMM / ESPN-style team id
 * @param bbsTeamId - Big Balls team id
 * @param bbsTeamName - Optional display name from BBS
 */
export async function upsertScoreboardTeamMap(
  ourTeamId: string,
  bbsTeamId: string,
  bbsTeamName: string | null = null,
): Promise<void> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  await sql`
    INSERT INTO scoreboard_team_map (environment, our_team_id, bbs_team_id, bbs_team_name, updated_at)
    VALUES (${environment}, ${ourTeamId}, ${bbsTeamId}, ${bbsTeamName}, NOW())
    ON CONFLICT (environment, our_team_id) DO UPDATE SET
      bbs_team_id = EXCLUDED.bbs_team_id,
      bbs_team_name = EXCLUDED.bbs_team_name,
      updated_at = NOW()
  `;
}

/**
 * List scoreboard grouping pages for a year.
 */
export async function listScoreboardPages(year: number): Promise<ScoreboardPage[]> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT * FROM scoreboard_pages
    WHERE environment = ${environment} AND year = ${year}
    ORDER BY sort_order ASC, label ASC
  `;
  return result.rows.map((row: Record<string, unknown>) => mapPage(row));
}

/**
 * Insert a page if absent (seed helper).
 */
export async function insertScoreboardPageIfAbsent(
  year: number,
  page: {
    slug: string;
    label: string;
    sortOrder: number;
    desktopCols: number;
    mobileCols: number;
  },
): Promise<void> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  await sql`
    INSERT INTO scoreboard_pages (
      environment, year, slug, label, sort_order, desktop_cols, mobile_cols
    ) VALUES (
      ${environment}, ${year}, ${page.slug}, ${page.label},
      ${page.sortOrder},
      ${Math.min(4, Math.max(1, page.desktopCols))},
      ${Math.min(2, Math.max(1, page.mobileCols))}
    )
    ON CONFLICT (environment, year, slug) DO NOTHING
  `;
}

/**
 * Update page label / order / density.
 */
export async function updateScoreboardPage(
  year: number,
  slug: string,
  patch: {
    label?: string;
    sortOrder?: number;
    desktopCols?: number;
    mobileCols?: number;
  },
): Promise<ScoreboardPage | null> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const pages = await listScoreboardPages(year);
  const current = pages.find((p) => p.slug === slug);
  if (!current) return null;
  const next = {
    label: patch.label?.trim() || current.label,
    sortOrder:
      patch.sortOrder !== undefined ? Math.round(patch.sortOrder) : current.sortOrder,
    desktopCols:
      patch.desktopCols !== undefined
        ? Math.min(4, Math.max(1, Math.round(patch.desktopCols)))
        : current.desktopCols,
    mobileCols:
      patch.mobileCols !== undefined
        ? Math.min(2, Math.max(1, Math.round(patch.mobileCols)))
        : current.mobileCols,
  };
  const result = await sql`
    UPDATE scoreboard_pages SET
      label = ${next.label},
      sort_order = ${next.sortOrder},
      desktop_cols = ${next.desktopCols},
      mobile_cols = ${next.mobileCols},
      updated_at = NOW()
    WHERE environment = ${environment} AND year = ${year} AND slug = ${slug}
    RETURNING *
  `;
  if (result.rows.length === 0) return null;
  return mapPage(result.rows[0] as Record<string, unknown>);
}

/**
 * Game keys assigned to a page, ordered.
 */
export async function listPageGameKeys(
  year: number,
  pageSlug: string,
): Promise<string[]> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT game_key FROM scoreboard_page_games
    WHERE environment = ${environment} AND year = ${year} AND page_slug = ${pageSlug}
    ORDER BY sort_order ASC, game_key ASC
  `;
  return result.rows.map((row: Record<string, unknown>) => String(row.game_key));
}

/**
 * All page↔game assignments for a year.
 */
export async function listAllPageGameAssignments(
  year: number,
): Promise<Array<{ pageSlug: string; gameKey: string; sortOrder: number }>> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT page_slug, game_key, sort_order FROM scoreboard_page_games
    WHERE environment = ${environment} AND year = ${year}
    ORDER BY page_slug ASC, sort_order ASC, game_key ASC
  `;
  return result.rows.map((row: Record<string, unknown>) => ({
    pageSlug: String(row.page_slug),
    gameKey: String(row.game_key),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

/**
 * Replace the game list for a page (ordered).
 */
export async function setPageGameKeys(
  year: number,
  pageSlug: string,
  gameKeys: string[],
): Promise<void> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  await sql`
    DELETE FROM scoreboard_page_games
    WHERE environment = ${environment} AND year = ${year} AND page_slug = ${pageSlug}
  `;
  for (let i = 0; i < gameKeys.length; i += 1) {
    const key = gameKeys[i]?.trim();
    if (!key) continue;
    await sql`
      INSERT INTO scoreboard_page_games (
        environment, year, page_slug, game_key, sort_order
      ) VALUES (
        ${environment}, ${year}, ${pageSlug}, ${key}, ${i}
      )
      ON CONFLICT (environment, year, page_slug, game_key) DO UPDATE SET
        sort_order = EXCLUDED.sort_order
    `;
  }
}

/**
 * Assign a single game to a page if not already on any page (seed helper).
 */
export async function assignGameToPageIfUnassigned(
  year: number,
  pageSlug: string,
  gameKey: string,
  sortOrder: number,
): Promise<void> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  const existing = await sql`
    SELECT 1 FROM scoreboard_page_games
    WHERE environment = ${environment} AND year = ${year} AND game_key = ${gameKey}
    LIMIT 1
  `;
  if (existing.rows.length > 0) return;
  await sql`
    INSERT INTO scoreboard_page_games (
      environment, year, page_slug, game_key, sort_order
    ) VALUES (
      ${environment}, ${year}, ${pageSlug}, ${gameKey}, ${sortOrder}
    )
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Move a game onto a page (removes any prior page assignment for that game).
 */
export async function moveGameToPage(
  year: number,
  pageSlug: string,
  gameKey: string,
  sortOrder: number,
): Promise<void> {
  await ensureScoreboardSchema();
  const environment = getCurrentEnvironment();
  await sql`
    DELETE FROM scoreboard_page_games
    WHERE environment = ${environment} AND year = ${year} AND game_key = ${gameKey}
  `;
  await sql`
    INSERT INTO scoreboard_page_games (
      environment, year, page_slug, game_key, sort_order
    ) VALUES (
      ${environment}, ${year}, ${pageSlug}, ${gameKey}, ${sortOrder}
    )
    ON CONFLICT (environment, year, page_slug, game_key) DO UPDATE SET
      sort_order = EXCLUDED.sort_order
  `;
}
