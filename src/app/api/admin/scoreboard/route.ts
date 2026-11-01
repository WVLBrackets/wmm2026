import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import {
  listScoreboardTeamMap,
  listScoreboardYears,
  updateScoreboardSettings,
  upsertScoreboardTeamMap,
} from '@/lib/repositories/scoreboardRepository';
import {
  getScoreboardForAdmin,
  upsertScoreboardGameAndApply,
} from '@/lib/services/scoreboardService';
import { listTournamentFieldYears } from '@/lib/tournamentLoaderServer';
import { mergeAvailableYears } from '@/lib/services/tournamentYearHelpers';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';
import { filterScoreboardYears } from '@/lib/scoreboardYears';
import type { ScoreboardGamePatch } from '@/lib/types/scoreboard';

/**
 * GET /api/admin/scoreboard?year=YYYY
 * Scoreboard of Record games + settings for admin UI.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 },
      );
    }

    const yearParam = request.nextUrl.searchParams.get('year');
    const year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return NextResponse.json(
        { success: false, error: 'Invalid year' },
        { status: 400 },
      );
    }

    const [{ games, settings }, teamMap, seededYears, activeYear] =
      await Promise.all([
        getScoreboardForAdmin(year),
        listScoreboardTeamMap(),
        listScoreboardYears().catch(() => [] as number[]),
        getActiveTournamentYear(),
      ]);
    const availableYears = filterScoreboardYears(
      mergeAvailableYears(
        [...seededYears, ...listTournamentFieldYears(), year],
        activeYear,
      ),
    );

    return NextResponse.json({
      success: true,
      data: {
        year,
        games,
        settings,
        teamMap,
        availableYears,
        bbsKeyConfigured: Boolean(
          process.env.API_KEY_BIGBALL?.trim() ||
            process.env.BBS_API_KEY?.trim() ||
            process.env.BIGBALLS_API_KEY?.trim(),
        ),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/scoreboard]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load scoreboard' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/scoreboard
 * Update a game and/or settings. Game finals update KEY / First Four + standings.
 */
export async function PATCH(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 },
      );
    }
    const adminUser = await getUserByEmail(session.user.email);
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Admin user not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return NextResponse.json(
        { success: false, error: 'Invalid year' },
        { status: 400 },
      );
    }

    if (body.settings && typeof body.settings === 'object') {
      const s = body.settings as Record<string, unknown>;
      await updateScoreboardSettings(year, {
        autoSyncEnabled:
          typeof s.autoSyncEnabled === 'boolean' ? s.autoSyncEnabled : undefined,
        pollIntervalMinutes:
          typeof s.pollIntervalMinutes === 'number'
            ? s.pollIntervalMinutes
            : undefined,
        bbsSeason:
          s.bbsSeason === null
            ? null
            : typeof s.bbsSeason === 'string'
              ? s.bbsSeason
              : undefined,
      });
    }

    if (body.teamMap && typeof body.teamMap === 'object') {
      const tm = body.teamMap as {
        ourTeamId?: string;
        bbsTeamId?: string;
        bbsTeamName?: string | null;
      };
      if (tm.ourTeamId?.trim() && tm.bbsTeamId?.trim()) {
        await upsertScoreboardTeamMap(
          tm.ourTeamId.trim(),
          tm.bbsTeamId.trim(),
          tm.bbsTeamName?.trim() || null,
        );
      }
    }

    let applyResult = null;
    let game = null;
    if (body.gameKey && typeof body.gameKey === 'string') {
      const patch = (body.patch || {}) as ScoreboardGamePatch;
      const result = await upsertScoreboardGameAndApply(
        year,
        body.gameKey,
        patch,
        'admin',
        adminUser.id,
      );
      game = result.game;
      applyResult = result.apply;
    }

    const refreshed = await getScoreboardForAdmin(year);
    return NextResponse.json({
      success: true,
      data: {
        ...refreshed,
        updatedGame: game,
        apply: applyResult,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/admin/scoreboard]', error);
    const message = error instanceof Error ? error.message : 'Failed to update scoreboard';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
