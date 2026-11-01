import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { syncScoreboardFromBbs } from '@/lib/services/scoreboardSyncService';
import { getScoreboardForAdmin } from '@/lib/services/scoreboardService';

/**
 * POST /api/admin/scoreboard/sync
 * Manual Sync now from Big Balls (bypasses kill switch / interval).
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return NextResponse.json(
        { success: false, error: 'Invalid year' },
        { status: 400 },
      );
    }

    const summary = await syncScoreboardFromBbs(year, adminUser.id, true);
    const board = await getScoreboardForAdmin(year);

    return NextResponse.json({
      success: true,
      data: { summary, ...board },
    });
  } catch (error) {
    console.error('[POST /api/admin/scoreboard/sync]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 },
    );
  }
}
