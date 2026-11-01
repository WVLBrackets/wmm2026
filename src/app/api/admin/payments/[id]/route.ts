import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import {
  confirmPayment,
  getPaymentById,
  rejectPayment,
} from '@/lib/repositories/paymentRepository';

/**
 * PUT /api/admin/payments/[id] — Confirm or reject a payment (admin only).
 * Body: { action: 'confirm' | 'reject', transactionId?: string, adminNotes?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: paymentId } = await params;
    const body = await request.json();
    const { action, transactionId, adminNotes } = body as {
      action: string;
      transactionId?: string;
      adminNotes?: string;
    };

    if (action !== 'confirm' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'action must be "confirm" or "reject".' },
        { status: 400 }
      );
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }
    if (payment.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Payment is already ${payment.status}.` },
        { status: 409 }
      );
    }

    if (action === 'confirm') {
      if (!transactionId?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Transaction ID is required when confirming.' },
          { status: 400 }
        );
      }

      await confirmPayment(
        paymentId,
        session.user.email,
        transactionId.trim(),
        adminNotes?.trim() || null,
        payment.bracket_ids,
      );

      return NextResponse.json({ success: true, message: 'Payment confirmed.' });
    }

    // reject
    await rejectPayment(
      paymentId,
      session.user.email,
      adminNotes?.trim() || null,
      payment.bracket_ids,
    );

    return NextResponse.json({ success: true, message: 'Payment rejected.' });
  } catch (error) {
    console.error('[PUT /api/admin/payments/[id]] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment.' }, { status: 500 });
  }
}
