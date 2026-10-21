import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { getMasterLockState } from '@/lib/killSwitch';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { evaluatePicksAccess } from '@/lib/services/picksAccessPolicy';
import { vintageAdminEmail } from '@/lib/vintage/admin';
import { evaluateVintageActionLockFresh } from '@/lib/services/vintageActionLockServer';
import { getPublishedVintageContent } from '@/lib/vintage/store';

/**
 * GET /api/bracket/check-creation - Check if bracket creation is currently allowed.
 *
 * Vintage primary admin: Action Lock master reference (published, tipoff, master
 * lock, JSON) from CMS — not Config Sheet stop_submit.
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

    const isVintageAdmin = Boolean(await vintageAdminEmail());
    if (isVintageAdmin) {
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
