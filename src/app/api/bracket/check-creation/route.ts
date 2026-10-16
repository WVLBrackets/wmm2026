import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { getMasterLockState } from '@/lib/killSwitch';
import { tryLoadTournamentData } from '@/lib/tournamentLoader';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { evaluatePicksAccess } from '@/lib/services/picksAccessPolicy';

/**
 * GET /api/bracket/check-creation - Check if bracket creation is currently allowed.
 *
 * Priority: brackets_available (+ JSON error) → stop_submit → Application Master Lock.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let siteConfig = null;
    try {
      siteConfig = await getSiteConfigFromGoogleSheetsFresh();
    } catch {
      siteConfig = FALLBACK_CONFIG;
    }

    const year = String(
      siteConfig?.tournamentYear || FALLBACK_CONFIG.tournamentYear || new Date().getFullYear()
    );
    const [tournamentData, masterLock] = await Promise.all([
      tryLoadTournamentData(year),
      getMasterLockState(),
    ]);

    const access = evaluatePicksAccess(siteConfig, {
      tournamentJsonPresent: Boolean(tournamentData),
      masterLockUnlocked: masterLock.unlocked,
    });

    return NextResponse.json({
      success: true,
      allowed: !access.blocked,
      reason: access.blocked ? access.message : undefined,
      reasonCode: access.reasonCode,
    });
  } catch (error) {
    console.error('Error checking bracket creation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check bracket creation status',
        allowed: false,
      },
      { status: 500 }
    );
  }
}
