import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import {
  adminCreatePaymentEntry,
  listPayments,
  normalizePaymentSource,
  type PaymentSource,
} from '@/lib/repositories/paymentRepository';
import { getSiteConfigCached } from '@/lib/siteConfigServer';

/**
 * GET /api/admin/payments — List payment requests (admin only).
 * Optional query params: status, userEmail
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const payments = await listPayments({
      status: searchParams.get('status'),
      userEmail: searchParams.get('userEmail'),
    });

    return NextResponse.json({ success: true, data: payments, count: payments.length });
  } catch (error) {
    console.error('[GET /api/admin/payments] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payments.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/payments — Admin Payment Entry (create; optional bracket link).
 * Body: {
 *   year, paymentNumber, userId, userEmail, amountDollars,
 *   source: venmo|zelle|cashapp|credit, bracketId?, note?
 * }
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const year = Number((body as { year?: unknown }).year);
    const paymentNumber = Number((body as { paymentNumber?: unknown }).paymentNumber);
    const bracketIdRaw = (body as { bracketId?: unknown }).bracketId;
    const bracketId =
      typeof bracketIdRaw === 'string' && bracketIdRaw.trim()
        ? bracketIdRaw.trim()
        : null;
    const userId =
      typeof (body as { userId?: unknown }).userId === 'string'
        ? (body as { userId: string }).userId.trim()
        : '';
    const userEmail =
      typeof (body as { userEmail?: unknown }).userEmail === 'string'
        ? (body as { userEmail: string }).userEmail.trim()
        : '';
    const amountDollars = Number((body as { amountDollars?: unknown }).amountDollars);
    const sourceRaw = (body as { source?: unknown }).source;
    const note =
      typeof (body as { note?: unknown }).note === 'string'
        ? (body as { note: string }).note
        : null;

    if (!Number.isFinite(year) || year < 2000) {
      return NextResponse.json({ success: false, error: 'year is required.' }, { status: 400 });
    }
    if (!Number.isFinite(paymentNumber) || paymentNumber < 1) {
      return NextResponse.json(
        { success: false, error: 'paymentNumber must be a positive integer.' },
        { status: 400 },
      );
    }
    if (!userId || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'userId and userEmail are required.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amountDollars) || amountDollars < 0) {
      return NextResponse.json(
        { success: false, error: 'amountDollars must be a non-negative number.' },
        { status: 400 },
      );
    }

    const allowed: PaymentSource[] = ['venmo', 'zelle', 'cashapp', 'credit'];
    const source = normalizePaymentSource(
      typeof sourceRaw === 'string' ? sourceRaw : 'venmo',
    );
    if (!allowed.includes(source)) {
      return NextResponse.json(
        { success: false, error: 'source must be Venmo, Zelle, CashApp, or Credit.' },
        { status: 400 },
      );
    }

    const siteConfig = await getSiteConfigCached();
    const entryCost = siteConfig.entryCost;
    if (entryCost == null || !Number.isFinite(entryCost)) {
      return NextResponse.json(
        { success: false, error: 'Entry cost is not configured in published Key Data.' },
        { status: 500 },
      );
    }

    const created = await adminCreatePaymentEntry({
      year: Math.floor(year),
      paymentNumber: Math.floor(paymentNumber),
      userId,
      userEmail,
      bracketId,
      amountCents: Math.round(amountDollars * 100),
      paymentMethod: source,
      adminEmail: session.user.email,
      entryCostDollars: entryCost,
      note,
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/payments] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment.';
    const status = message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
