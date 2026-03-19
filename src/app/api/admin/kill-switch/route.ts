import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { getMasterKillSwitchEnabled, setMasterKillSwitchEnabled } from '@/lib/repositories/featureFlagRepository';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { validateTrustedOrigin } from '@/lib/requestSecurity';

/**
 * GET /api/admin/kill-switch - Admin-only kill switch state.
 */
export async function GET() {
  try {
    await requireAdmin();
    const [enabled, config] = await Promise.all([
      getMasterKillSwitchEnabled(),
      getSiteConfigFromGoogleSheetsFresh().catch(() => null),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        enabled,
        message: config?.killSwitchOn || FALLBACK_CONFIG.killSwitchOn,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin kill switch GET error:', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    return NextResponse.json({ success: false, error: 'Failed to load kill switch' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/kill-switch - Admin-only kill switch update.
 */
export async function PUT(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) {
    return csrfError;
  }

  const originValidation = validateTrustedOrigin(request);
  if (!originValidation.valid) {
    return NextResponse.json(
      { success: false, error: originValidation.error || 'Untrusted request origin' },
      { status: 403 }
    );
  }

  try {
    await requireAdmin();
    const body = await request.json();
    const enabled = Boolean(body?.enabled);
    const updated = await setMasterKillSwitchEnabled(enabled);
    return NextResponse.json({ success: true, data: { enabled: updated } });
  } catch (error) {
    console.error('Admin kill switch PUT error:', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    return NextResponse.json({ success: false, error: 'Failed to update kill switch' }, { status: 500 });
  }
}
