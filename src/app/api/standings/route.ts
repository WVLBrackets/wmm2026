import { NextRequest, NextResponse } from 'next/server';
import { getStandingsData } from '@/lib/standingsData';

/**
 * GET /api/standings?day=Day1
 * Returns standings data for a given day from the environment-specific sheet.
 */
export async function GET(request: NextRequest) {
  try {
    const day = request.nextUrl.searchParams.get('day') || 'Day1';
    const data = await getStandingsData(day);

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load standings data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
