import { NextResponse } from 'next/server';
import { getAvailableDays } from '@/lib/standingsData';

/**
 * GET /api/standings/days
 * Returns available standings tabs/day options.
 */
export async function GET() {
  try {
    const data = await getAvailableDays();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load standings day options';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
