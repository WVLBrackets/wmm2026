import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { csrfProtection } from '@/lib/csrf';

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

    const existing = await sql`SELECT * FROM payments WHERE id = ${paymentId}`;
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }

    const payment = existing.rows[0] as { status: string; bracket_ids: string[] };
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

      await sql`
        UPDATE payments
        SET status = 'confirmed',
            confirmed_at = now(),
            confirmed_by = ${session.user.email},
            admin_transaction_id = ${transactionId.trim()},
            admin_notes = ${adminNotes?.trim() || null}
        WHERE id = ${paymentId}
      `;

      for (const bracketId of payment.bracket_ids) {
        await sql`
          UPDATE brackets SET payment_status = 'paid'
          WHERE id = ${bracketId} AND payment_id = ${paymentId}
        `;
      }

      return NextResponse.json({ success: true, message: 'Payment confirmed.' });
    }

    // reject
    await sql`
      UPDATE payments
      SET status = 'rejected',
          confirmed_at = now(),
          confirmed_by = ${session.user.email},
          admin_notes = ${adminNotes?.trim() || null}
      WHERE id = ${paymentId}
    `;

    for (const bracketId of payment.bracket_ids) {
      await sql`
        UPDATE brackets SET payment_status = NULL, payment_id = NULL
        WHERE id = ${bracketId} AND payment_id = ${paymentId}
      `;
    }

    return NextResponse.json({ success: true, message: 'Payment rejected.' });
  } catch (error) {
    console.error('[PUT /api/admin/payments/[id]] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment.' }, { status: 500 });
  }
}
