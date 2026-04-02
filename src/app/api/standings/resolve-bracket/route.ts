import { NextRequest, NextResponse } from 'next/server';
import { findSubmittedPoolBracketIdByLabel } from '@/lib/repositories/bracketRepository';

/**
 * GET /api/standings/resolve-bracket?year=2026&q=EntryNameOrPlayer
 * Public: resolves a submitted pool bracket id for daily standings row clicks.
 */
export async function GET(request: NextRequest) {
  try {
    const yearRaw = request.nextUrl.searchParams.get('year');
    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

    const year = yearRaw ? parseInt(yearRaw, 10) : NaN;
    if (!q || Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or missing q' },
        { status: 400 }
      );
    }

    const bracketId = await findSubmittedPoolBracketIdByLabel(year, q);
    if (!bracketId) {
      return NextResponse.json(
        { success: false, error: 'No unique bracket match for this label' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { bracketId } });
  } catch (error) {
    console.error('[GET /api/standings/resolve-bracket]', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve bracket' }, { status: 500 });
  }
}
