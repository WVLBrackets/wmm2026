import { NextResponse } from 'next/server';
import { getKillSwitchState } from '@/lib/killSwitch';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

/**
 * GET /api/kill-switch - Public kill switch state and user-facing message.
 * Uses {@link getKillSwitchState} (no Google Sheets round-trip when the switch is ON).
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
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error loading kill switch state:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load kill switch state',
        data: {
          enabled: true,
          message: FALLBACK_CONFIG.killSwitchOn,
        },
      },
      { status: 500 }
    );
  }
}
