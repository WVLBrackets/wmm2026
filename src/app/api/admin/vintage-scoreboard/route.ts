import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { authorizeVintageRequest } from '@/lib/vintage/admin';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import {
  getScoreboardDefaultYear,
  listScoreboardGames,
  listScoreboardYears,
  setScoreboardDefaultYear,
} from '@/lib/repositories/scoreboardRepository';
import { getScoreboardSnapshot } from '@/lib/repositories/scoreboardSnapshotRepository';
import {
  publishPublicScoreboardGames,
  rebuildScoreboardSnapshot,
  replacePageGames,
  sliceScoreboardSnapshot,
  updatePublicScoreboardGame,
  updatePublicScoreboardPage,
} from '@/lib/services/publicScoreboardService';
import { listTournamentFieldYears } from '@/lib/tournamentLoaderServer';
import { mergeAvailableYears } from '@/lib/services/tournamentYearHelpers';
import {
  filterScoreboardYears,
  SCOREBOARD_MIN_YEAR,
} from '@/lib/scoreboardYears';
import type { ScoreboardGamePatch } from '@/lib/types/scoreboard';

/**
 * Primary vintage admin or ops ADMIN_EMAIL (with CSRF on mutating methods).
 */
async function authorizeScoreboardAdmin(
  request: NextRequest,
): Promise<{ email: string } | Response> {
  const vintage = await authorizeVintageRequest(request);
  if (!(vintage instanceof Response)) return vintage;

  // Fall back to ops admin when vintage primary check fails (403).
  if (vintage.status !== 403) return vintage;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !(await isAdmin(email))) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: 403 },
    );
  }
  const method = request.method.toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = csrfProtection(request);
    if (csrf) return csrf;
  }
  return { email };
}

/**
 * GET /api/admin/vintage-scoreboard?year=&slug=
 * Admin board (snapshot) + live game catalog for assignment UI.
 * If no snapshot exists yet, rebuilds once so the editor is usable.
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeScoreboardAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const yearParam = request.nextUrl.searchParams.get('year');
    const slug = request.nextUrl.searchParams.get('slug');
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      return NextResponse.json(
        { success: false, error: 'Invalid year' },
        { status: 400 },
      );
    }
    const year = Number(yearParam);

    let snap = await getScoreboardSnapshot(year);
    if (!snap) {
      snap = await rebuildScoreboardSnapshot(year);
    }
    const board = sliceScoreboardSnapshot(snap, slug);
    const [allGames, seededYears, defaultYear] = await Promise.all([
      listScoreboardGames(year),
      listScoreboardYears().catch(() => [] as number[]),
      getScoreboardDefaultYear(year),
    ]);
    const availableYears = filterScoreboardYears(
      mergeAvailableYears(
        [...seededYears, ...listTournamentFieldYears(), year],
        defaultYear,
      ),
    );

    return NextResponse.json({
      success: true,
      data: {
        board,
        defaultYear,
        availableYears,
        catalog: allGames.map((g) => ({
          gameKey: g.gameKey,
          kind: g.kind,
          roundLabel: g.roundLabel,
          team1Name: g.team1Name,
          team2Name: g.team2Name,
          status: g.status,
        })),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/vintage-scoreboard]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load admin scoreboard' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/vintage-scoreboard
 * Manual scoreboard edits; newly final games update KEY / First Four / standings.
 * Rebuilds public snapshot after writes. Body `{ rebuild: true }` rebuilds only.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorizeScoreboardAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const adminUser = await getUserByEmail(auth.email);
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

    let defaultYear: number | undefined;
    if (body.defaultYear != null) {
      const nextDefault = Number(body.defaultYear);
      if (
        !Number.isInteger(nextDefault) ||
        nextDefault < SCOREBOARD_MIN_YEAR ||
        nextDefault > 9999
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Default year must be ${SCOREBOARD_MIN_YEAR} or later`,
          },
          { status: 400 },
        );
      }
      defaultYear = await setScoreboardDefaultYear(nextDefault);
    }

    if (body.rebuild === true) {
      const snap = await rebuildScoreboardSnapshot(year);
      const board = sliceScoreboardSnapshot(
        snap,
        typeof body.slug === 'string' ? body.slug : null,
      );
      return NextResponse.json({
        success: true,
        data: {
          board,
          defaultYear:
            defaultYear ?? (await getScoreboardDefaultYear(year)),
        },
      });
    }

    if (
      body.defaultYear != null &&
      !body.games &&
      !body.gameKey &&
      !body.page &&
      !body.pageGames
    ) {
      // Settings-only save — still rebuild so date labels / play-in stay current.
      const snap = await rebuildScoreboardSnapshot(year);
      const board = sliceScoreboardSnapshot(
        snap,
        typeof body.slug === 'string' ? body.slug : null,
      );
      return NextResponse.json({
        success: true,
        data: { board, defaultYear },
      });
    }

    if (body.page && typeof body.page.slug === 'string') {
      await updatePublicScoreboardPage(year, body.page.slug, {
        label: typeof body.page.label === 'string' ? body.page.label : undefined,
        sortOrder:
          typeof body.page.sortOrder === 'number' ? body.page.sortOrder : undefined,
        desktopCols:
          typeof body.page.desktopCols === 'number'
            ? body.page.desktopCols
            : undefined,
        mobileCols:
          typeof body.page.mobileCols === 'number'
            ? body.page.mobileCols
            : undefined,
      });
    }

    if (
      body.pageGames &&
      typeof body.pageGames.slug === 'string' &&
      Array.isArray(body.pageGames.gameKeys)
    ) {
      await replacePageGames(
        year,
        body.pageGames.slug,
        body.pageGames.gameKeys.map(String),
      );
    }

    let applyResult = null as Awaited<
      ReturnType<typeof updatePublicScoreboardGame>
    >['apply'];
    let batchApplies: Awaited<
      ReturnType<typeof publishPublicScoreboardGames>
    >['results'] = [];

    if (Array.isArray(body.games)) {
      const games = body.games
        .filter(
          (row: unknown): row is { gameKey: string; patch: ScoreboardGamePatch } =>
            Boolean(
              row &&
                typeof row === 'object' &&
                typeof (row as { gameKey?: unknown }).gameKey === 'string',
            ),
        )
        .map((row: { gameKey: string; patch?: ScoreboardGamePatch }) => ({
          gameKey: row.gameKey,
          patch: (row.patch || {}) as ScoreboardGamePatch,
        }));
      if (games.length > 0) {
        const published = await publishPublicScoreboardGames(
          year,
          games,
          adminUser.id,
        );
        batchApplies = published.results;
        for (const row of batchApplies) {
          if (row.apply && row.apply.applied === false && row.apply.reason) {
            console.warn(
              '[PATCH /api/admin/vintage-scoreboard] apply skipped/failed:',
              row.gameKey,
              row.apply.reason,
            );
          }
        }
      }
    } else if (body.gameKey && typeof body.gameKey === 'string') {
      const patch = (body.patch || {}) as ScoreboardGamePatch;
      const result = await updatePublicScoreboardGame(
        year,
        body.gameKey,
        patch,
        adminUser.id,
      );
      applyResult = result.apply;
      if (applyResult && applyResult.applied === false && applyResult.reason) {
        console.warn(
          '[PATCH /api/admin/vintage-scoreboard] apply skipped/failed:',
          applyResult.reason,
        );
      }
    }

    const slug =
      (typeof body.slug === 'string' && body.slug) ||
      (typeof body.page?.slug === 'string' && body.page.slug) ||
      (typeof body.pageGames?.slug === 'string' && body.pageGames.slug) ||
      null;

    const snap = await rebuildScoreboardSnapshot(year);
    const board = sliceScoreboardSnapshot(snap, slug);
    return NextResponse.json({
      success: true,
      data: {
        board,
        defaultYear:
          defaultYear ?? (await getScoreboardDefaultYear(year)),
        apply: applyResult,
        applies: batchApplies,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/admin/vintage-scoreboard]', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update scoreboard';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
