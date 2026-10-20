import { NextRequest, NextResponse } from 'next/server';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { getLiveStandingsSnapshot } from '@/lib/repositories/liveStandingsSnapshotRepository';
import { getKeyBracketByYear } from '@/lib/repositories/bracketRepository';
import { recomputeLiveStandingsAfterKeySave } from '@/lib/liveStandingsService';
import { getTournamentWorkspace } from '@/lib/repositories/tournamentRepository';
import { FIRST_MANAGED_YEAR } from '@/lib/tournamentDefinition';

/**
 * GET /api/live-standings?year=2026
 * Public read of cached live standings snapshot (recomputed when KEY is saved).
 * If no snapshot exists yet but a KEY bracket does, recomputes once on this request (cold start).
 */
export async function GET(request: NextRequest) {
  try {
    const paramYear = request.nextUrl.searchParams.get('year');
    let yearNum: number;
    if (paramYear && /^\d{4}$/.test(paramYear)) {
      yearNum = parseInt(paramYear, 10);
    } else {
      const config = (await getSiteConfigFromGoogleSheets()) ?? FALLBACK_CONFIG;
      const sy = config.standingsYear || config.tournamentYear || String(new Date().getFullYear());
      yearNum = parseInt(String(sy).trim(), 10);
      if (Number.isNaN(yearNum)) {
        yearNum = new Date().getFullYear();
      }
    }

    let snapshot = await getLiveStandingsSnapshot(yearNum);
    const revision = yearNum >= FIRST_MANAGED_YEAR ? (await getTournamentWorkspace(yearNum)).revision : undefined;
    const outdatedField = Boolean(snapshot) && revision !== undefined && snapshot!.standingsData.tournamentRevision !== revision;

    /**
     * Snapshots older than the My Entries / YOURS work omit `userId` on rows.
     * Recompute once so filter-by-owner matches session.user.id.
     */
    const needsOwnerIds =
      Boolean(snapshot) &&
      snapshot!.standingsData.entries.some(
        (e) => e.bracketId && !e.userId,
      );

    if (!snapshot || needsOwnerIds || outdatedField) {
      const keyBracket = await getKeyBracketByYear(yearNum);
      if (keyBracket) {
        const result = await recomputeLiveStandingsAfterKeySave(yearNum, keyBracket.id);
        if (result.ok) {
          snapshot = await getLiveStandingsSnapshot(yearNum);
        } else {
          console.error('[GET /api/live-standings] Lazy recompute failed:', result.error);
          if (outdatedField) return NextResponse.json({ success: false, error: 'Standings are refreshing after a tournament update. Please retry.' }, { status: 503 });
        }
      }
    }

    if (!snapshot) {
      return NextResponse.json(
        {
          success: true,
          available: false,
          year: yearNum,
          message: 'Live Standings Not Available',
        },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        available: true,
        year: snapshot.year,
        keyBracketId: snapshot.keyBracketId,
        keyUpdatedAt: snapshot.keyUpdatedAt.toISOString(),
        computedAt: snapshot.computedAt.toISOString(),
        standingsData: snapshot.standingsData,
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[GET /api/live-standings]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load live standings' },
      { status: 500 }
    );
  }
}
