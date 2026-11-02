import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import {
  getPaymentsAdminYearFilterByEmail,
  parsePaymentsAdminYearFilter,
  updatePaymentsAdminYearFilterByEmail,
} from '@/lib/repositories/userRepository';

/**
 * GET /api/admin/payments/preferences — Load persisted Payments admin UI prefs.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const yearFilter = await getPaymentsAdminYearFilterByEmail(session.user.email);
    return NextResponse.json({
      success: true,
      data: {
        yearFilter: yearFilter ?? new Date().getFullYear(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/payments/preferences] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load payment preferences.' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/payments/preferences — Persist Payments year filter (admin only).
 * Body: { yearFilter: number | "all" }
 */
export async function PUT(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const raw = (body as { yearFilter?: unknown }).yearFilter;
    const parsed =
      raw === 'all' || raw === 'All'
        ? ('all' as const)
        : parsePaymentsAdminYearFilter(
            typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : null,
          );

    if (parsed == null) {
      return NextResponse.json(
        { success: false, error: 'yearFilter must be a year (e.g. 2026) or "all".' },
        { status: 400 },
      );
    }

    const ok = await updatePaymentsAdminYearFilterByEmail(session.user.email, parsed);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { yearFilter: parsed } });
  } catch (error) {
    console.error('[PUT /api/admin/payments/preferences] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save payment preferences.' },
      { status: 500 },
    );
  }
}
