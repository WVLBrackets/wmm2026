import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { listPayments } from '@/lib/repositories/paymentRepository';

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
