import { NextRequest, NextResponse } from 'next/server';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';
import { getPublicScoreboard } from '@/lib/services/publicScoreboardService';

/**
 * GET /api/scoreboard?year=&slug=
 * Public read of the cached scoreboard snapshot only (no rebuild).
 */
export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get('year');
    const slug = request.nextUrl.searchParams.get('slug');
    const year =
      yearParam && /^\d{4}$/.test(yearParam)
        ? Number(yearParam)
        : await getActiveTournamentYear();

    const data = await getPublicScoreboard(year, slug);
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          // Snapshot is rebuilt on admin save; short cache is fine for pool traffic.
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('[GET /api/scoreboard]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load scoreboard' },
      { status: 500 },
    );
  }
}
