import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { evaluateVintageActionLockFresh } from '@/lib/services/vintageActionLockServer';
import { getPublishedVintageContent } from '@/lib/vintage/store';

/**
 * GET /api/bracket/check-creation - Check if bracket creation is currently allowed.
 * Uses vintage Action Lock (My Picks CMS + homepage) for all authenticated users.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const home = await getPublishedVintageContent();
    const activeYear = parseInt(String(home.tournament.year).trim(), 10);
    if (Number.isNaN(activeYear)) {
      return NextResponse.json({
        success: true,
        allowed: false,
        reason: 'Active Tourney Year is not configured on the homepage.',
        reasonCode: 'brackets_missing_json',
      });
    }
    const fresh = await evaluateVintageActionLockFresh({
      action: 'changing',
      bracketYear: activeYear,
      home,
    });
    return NextResponse.json({
      success: true,
      allowed: !fresh.blocked,
      reason: fresh.blocked ? fresh.message : undefined,
      reasonCode: fresh.reasonCode,
    });
  } catch (error) {
    console.error('Error checking bracket creation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check bracket creation status',
        allowed: false,
      },
      { status: 500 },
    );
  }
}
