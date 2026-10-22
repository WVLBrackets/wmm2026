import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { getKillSwitchState } from '@/lib/killSwitch';
import { validateTrustedOrigin } from '@/lib/requestSecurity';

/**
 * GET /api/admin/kill-switch — read Application Master Lock from My Picks CMS.
 */
export async function GET() {
  try {
    await requireAdmin();
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
    console.error('Admin kill switch GET error:', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to load kill switch' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/kill-switch — retired; use My Picks CMS Application Master Lock.
 */
export async function PUT(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  const originValidation = validateTrustedOrigin(request);
  if (!originValidation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: originValidation.error || 'Untrusted request origin',
      },
      { status: 403 },
    );
  }

  try {
    await requireAdmin();
    return NextResponse.json(
      {
        success: false,
        error:
          'Application Master Lock is managed in Vintage My Picks admin (/vintage/admin/picks).',
      },
      { status: 410 },
    );
  } catch (error) {
    console.error('Admin kill switch PUT error:', error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update kill switch' },
      { status: 500 },
    );
  }
}
