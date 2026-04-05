import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { adminBulkBracketPaymentAction } from '@/lib/repositories/bracketRepository';
import { csrfProtection } from '@/lib/csrf';

/**
 * POST /api/admin/payments/bulk — Confirm or reject payment fields for many brackets (admin only).
 * Body: { bracketIds: string[], action: 'confirm' | 'reject', transactionId?: string, adminNotes?: string }
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
    const { bracketIds, action, transactionId, adminNotes } = body as {
      bracketIds?: unknown;
      action?: string;
      transactionId?: string;
      adminNotes?: string;
    };

    if (!Array.isArray(bracketIds) || bracketIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'bracketIds must be a non-empty array.' },
        { status: 400 }
      );
    }

    if (action !== 'confirm' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'action must be "confirm" or "reject".' },
        { status: 400 }
      );
    }

    const result = await adminBulkBracketPaymentAction(
      bracketIds as string[],
      action,
      {
        transactionId,
        adminEmail: session.user.email,
        adminNotes: adminNotes?.trim() || null,
      }
    );

    return NextResponse.json({
      success: true,
      data: result,
      message:
        action === 'confirm'
          ? `Marked ${result.bracketsUpdated} bracket(s) paid.`
          : `Cleared payment on ${result.bracketsUpdated} bracket(s).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk update failed.';
    if (
      message.includes('Transaction ID') ||
      message.includes('Bracket not found')
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    console.error('[POST /api/admin/payments/bulk] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to apply bulk payment update.' }, { status: 500 });
  }
}
