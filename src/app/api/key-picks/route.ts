import { NextRequest, NextResponse } from 'next/server';
import { getKeyBracketByYear } from '@/lib/repositories/bracketRepository';
import { isPoolBracketReadBlockedBeforeStandingsLive } from '@/lib/services/standingsRosterGate';

/**
 * GET /api/key-picks?year=2026
 * Public KEY picks for bracket viewer compare-to-KEY, aligned with pool privacy:
 * active homepage year while Standings Tournament Live is off → empty / unavailable.
 * Prior years (and active year once Live is on) may return KEY picks when present.
 */
export async function GET(request: NextRequest) {
  try {
    const yearRaw = request.nextUrl.searchParams.get('year');
    const year = yearRaw ? parseInt(yearRaw, 10) : NaN;
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing year' },
        { status: 400 },
      );
    }

    if (await isPoolBracketReadBlockedBeforeStandingsLive(year)) {
      return NextResponse.json(
        {
          success: true,
          data: {
            available: false,
            picks: {},
            reason: 'tournament_live_off',
          },
        },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const keyBracket = await getKeyBracketByYear(year);
    const picks =
      keyBracket?.picks &&
      typeof keyBracket.picks === 'object' &&
      !Array.isArray(keyBracket.picks)
        ? (keyBracket.picks as Record<string, string>)
        : {};

    return NextResponse.json(
      {
        success: true,
        data: {
          available: Boolean(keyBracket),
          picks,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[GET /api/key-picks]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load KEY picks' },
      { status: 500 },
    );
  }
}
