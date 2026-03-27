import { NextRequest, NextResponse } from 'next/server';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { getLiveStandingsSnapshot } from '@/lib/repositories/liveStandingsSnapshotRepository';
import { getKeyBracketByYear } from '@/lib/repositories/bracketRepository';
import { recomputeLiveStandingsAfterKeySave } from '@/lib/liveStandingsService';

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

    if (!snapshot) {
      const keyBracket = await getKeyBracketByYear(yearNum);
      if (keyBracket) {
        const result = await recomputeLiveStandingsAfterKeySave(yearNum, keyBracket.id);
        if (result.ok) {
          snapshot = await getLiveStandingsSnapshot(yearNum);
        } else {
          console.error('[GET /api/live-standings] Lazy recompute failed:', result.error);
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
        entries: snapshot.entries,
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
