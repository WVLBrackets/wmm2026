import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';
import { syncScoreboardFromBbs } from '@/lib/services/scoreboardSyncService';

/**
 * Authorize cron callers via Bearer CRON_SECRET (Vercel Cron or manual).
 *
 * @param request - Incoming request
 */
function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  // Vercel Cron also sends `Authorization: Bearer <CRON_SECRET>` when configured.
  return bearer === secret;
}

/**
 * Resolve the user id used for KEY writes during cron sync.
 * Prefers ADMIN_EMAIL's user record; falls back to SCOREBOARD_SYNC_ACTOR_USER_ID.
 */
async function resolveSyncActorUserId(): Promise<string | null> {
  const override = process.env.SCOREBOARD_SYNC_ACTOR_USER_ID?.trim();
  if (override) return override;

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) return null;
  const admin = await getUserByEmail(adminEmail);
  return admin?.id ?? null;
}

/**
 * POST /api/cron/scoreboard-sync
 * Optional scripted sync (Bearer CRON_SECRET). Not scheduled on Hobby —
 * day-to-day pulls use Admin → Scoreboard → Sync now.
 * Optional query `year=` overrides active tourney year (ops only).
 */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const yearParam = request.nextUrl.searchParams.get('year');
    const year =
      yearParam && /^\d{4}$/.test(yearParam)
        ? Number(yearParam)
        : await getActiveTournamentYear();

    const actorUserId = await resolveSyncActorUserId();
    if (!actorUserId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No sync actor user: set ADMIN_EMAIL to a registered admin or SCOREBOARD_SYNC_ACTOR_USER_ID',
        },
        { status: 500 },
      );
    }

    // force=false → respects kill switch + poll interval
    const summary = await syncScoreboardFromBbs(year, actorUserId, false);

    return NextResponse.json({
      success: true,
      data: { year, summary },
    });
  } catch (error) {
    console.error('[POST /api/cron/scoreboard-sync]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron sync failed',
      },
      { status: 500 },
    );
  }
}

/**
 * GET allowed for Vercel Cron (same auth). Some platforms invoke GET.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
