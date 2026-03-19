import { NextResponse } from 'next/server';
import { getMasterKillSwitchEnabled } from '@/lib/repositories/featureFlagRepository';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

/**
 * GET /api/kill-switch - Public kill switch state and user-facing message.
 */
export async function GET() {
  try {
    const [enabled, config] = await Promise.all([
      getMasterKillSwitchEnabled(),
      getSiteConfigFromGoogleSheetsFresh().catch(() => null),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          enabled,
          message: config?.killSwitchOn || FALLBACK_CONFIG.killSwitchOn,
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
