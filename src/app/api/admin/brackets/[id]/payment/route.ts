import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { adminUpdateBracketPaymentStatus, type AdminBracketPaymentStatus } from '@/lib/repositories/bracketRepository';
import { csrfProtection } from '@/lib/csrf';

/**
 * PATCH /api/admin/brackets/[id]/payment — Set bracket payment status (admin only).
 * Body: { paymentStatus: 'unpaid' | 'pending' | 'paid' }
 */
export async function PATCH(
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

    const { id: bracketId } = await params;
    const body = await request.json();
    const raw = (body as { paymentStatus?: string }).paymentStatus;
    const allowed: AdminBracketPaymentStatus[] = ['unpaid', 'pending', 'paid'];
    if (!raw || !allowed.includes(raw as AdminBracketPaymentStatus)) {
      return NextResponse.json(
        { success: false, error: 'paymentStatus must be unpaid, pending, or paid.' },
        { status: 400 }
      );
    }

    const updated = await adminUpdateBracketPaymentStatus(bracketId, raw as AdminBracketPaymentStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Bracket not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        paymentStatus: updated.paymentStatus ?? null,
        paymentId: updated.paymentId ?? null,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/admin/brackets/[id]/payment] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment status.' }, { status: 500 });
  }
}
