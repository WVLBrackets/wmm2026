import { NextResponse } from 'next/server';
import { getKillSwitchState } from '@/lib/killSwitch';
import { SiteConfigError } from '@/lib/siteConfig';

/**
 * GET /api/kill-switch - Public Application Master Lock state and message.
 * Reads published homepage Key Data only — no Config Sheet.
 */
export async function GET() {
  try {
    const state = await getKillSwitchState();
    return NextResponse.json(
      {
        success: true,
        data: {
          enabled: state.enabled,
          message: state.message,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Error loading kill switch state:', error);
    const message =
      error instanceof SiteConfigError
        ? error.message
        : 'Failed to load Application Master Lock state';
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof SiteConfigError ? 503 : 500 },
    );
  }
}
