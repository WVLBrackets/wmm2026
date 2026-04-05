import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/payments — List payment requests (admin only).
 * Optional query params: status (pending|confirmed|rejected), userEmail
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status')?.trim() || null;
    const emailFilter = searchParams.get('userEmail')?.trim() || null;
    const environment = getCurrentEnvironment();

    const result = await sql`
      SELECT * FROM payments
      WHERE environment = ${environment}
        AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
        AND (${emailFilter}::text IS NULL OR user_email ILIKE ${'%' + (emailFilter ?? '') + '%'})
      ORDER BY requested_at DESC
      LIMIT 500
    `;

    interface PaymentRow {
      id: string;
      user_id: string;
      user_email: string;
      bracket_ids: string[];
      bracket_count: number;
      additional_count: number;
      additional_note: string | null;
      amount_cents: number;
      venmo_note: string | null;
      status: string;
      requested_at: string;
      confirmed_at: string | null;
      confirmed_by: string | null;
      admin_transaction_id: string | null;
      admin_notes: string | null;
      environment: string;
    }

    const payments = result.rows.map((row: PaymentRow) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      bracketIds: row.bracket_ids,
      bracketCount: row.bracket_count,
      additionalCount: row.additional_count,
      additionalNote: row.additional_note,
      amountCents: row.amount_cents,
      venmoNote: row.venmo_note,
      status: row.status,
      requestedAt: row.requested_at,
      confirmedAt: row.confirmed_at,
      confirmedBy: row.confirmed_by,
      adminTransactionId: row.admin_transaction_id,
      adminNotes: row.admin_notes,
    }));

    return NextResponse.json({ success: true, data: payments, count: payments.length });
  } catch (error) {
    console.error('[GET /api/admin/payments] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payments.' }, { status: 500 });
  }
}
