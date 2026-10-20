import { NextRequest, NextResponse } from 'next/server';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year') ?? '';
  if (!/^20\d{2}$/.test(year)) return NextResponse.json({ error: 'Invalid year.' }, { status: 400 });
  try {
    const data = await tryLoadTournamentData(year);
    return NextResponse.json(data ?? { error: 'Tournament not published.' }, { status: data ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[tournament-data]', e);
    return NextResponse.json({ error: 'Tournament data is temporarily unavailable.' }, { status: 503 });
  }
}
