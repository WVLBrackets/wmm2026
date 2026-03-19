import { NextResponse } from 'next/server';

/**
 * GET /api/server-time
 * Provides current server epoch time for client-side clock synchronization.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        nowMs: Date.now(),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
