import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getBracketById, getKeyBracketByYear } from '@/lib/repositories/bracketRepository';
import { loadTournamentData } from '@/lib/tournamentLoader';
import { buildLiveScoreDetailLines } from '@/lib/liveStandingsScoring';

/**
 * GET /api/admin/brackets/[id]/live-score-detail — admin-only audit of live points vs KEY.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const bracket = await getBracketById(id);

    if (!bracket) {
      return NextResponse.json({ success: false, error: 'Bracket not found' }, { status: 404 });
    }

    if (bracket.isKey) {
      return NextResponse.json(
        { success: false, error: 'Live score detail is only for player brackets, not KEY.' },
        { status: 400 }
      );
    }

    const year = bracket.year;
    if (year == null || Number.isNaN(Number(year))) {
      return NextResponse.json(
        { success: false, error: 'Bracket has no tournament year.' },
        { status: 400 }
      );
    }

    const key = await getKeyBracketByYear(Number(year));
    if (!key) {
      return NextResponse.json(
        { success: false, error: `No KEY bracket for year ${year}.` },
        { status: 404 }
      );
    }

    const tournamentData = await loadTournamentData(String(year));
    const { lines, total } = buildLiveScoreDetailLines(
      tournamentData,
      key.picks || {},
      bracket.picks || {}
    );

    return NextResponse.json({
      success: true,
      data: {
        bracketId: bracket.id,
        entryName: bracket.entryName,
        year,
        lines,
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    console.error('live-score-detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build live score detail' },
      { status: 500 }
    );
  }
}
