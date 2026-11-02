import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import {
  confirmClaimPayment,
  deletePayment,
  getPaymentById,
  removeBracketIdFromPayment,
  updatePaymentAdminNotes,
  updatePaymentStatus,
} from '@/lib/repositories/paymentRepository';
import { normalizePaymentStatus } from '@/lib/payments/paymentAllocation';
import { getSiteConfigCached } from '@/lib/siteConfigServer';

/**
 * Resolve published entry cost for allocation / auto-reconcile.
 */
async function requireEntryCost(): Promise<number> {
  const siteConfig = await getSiteConfigCached();
  const entryCost = siteConfig.entryCost;
  if (entryCost == null || !Number.isFinite(entryCost)) {
    throw new Error('Entry cost is not configured in published Key Data.');
  }
  return entryCost;
}

/**
 * PATCH /api/admin/payments/[id] — Update comment, status, or unlink a bracket id (admin only).
 * Body:
 * - { adminNotes: string | null }
 * - { unlinkBracketId: string }
 * - { status: 'claimed' | 'confirmed' | 'reconciled', adminNotes?: string }
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

    const { id: paymentId } = await params;
    const body = await request.json();

    const unlinkBracketId = (body as { unlinkBracketId?: unknown }).unlinkBracketId;
    if (typeof unlinkBracketId === 'string' && unlinkBracketId.trim()) {
      const entryCost = await requireEntryCost();
      const ok = await removeBracketIdFromPayment(
        paymentId,
        unlinkBracketId.trim(),
        entryCost,
      );
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: { id: paymentId, unlinkedBracketId: unlinkBracketId.trim() },
      });
    }

    const rawStatus = (body as { status?: unknown }).status;
    if (typeof rawStatus === 'string' && rawStatus.trim()) {
      const status = normalizePaymentStatus(rawStatus);
      if (status === 'rejected' || !['claimed', 'confirmed', 'reconciled'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'status must be claimed, confirmed, or reconciled.' },
          { status: 400 },
        );
      }
      const entryCost = await requireEntryCost();
      const notesRaw = (body as { adminNotes?: unknown }).adminNotes;
      const adminNotes =
        typeof notesRaw === 'string'
          ? notesRaw.trim() || null
          : notesRaw === null
            ? null
            : undefined;
      const updated = await updatePaymentStatus(
        paymentId,
        status,
        session.user.email,
        entryCost,
        adminNotes,
      );
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: updated });
    }

    const rawNotes = (body as { adminNotes?: unknown }).adminNotes;
    const adminNotes =
      typeof rawNotes === 'string' ? rawNotes.trim() || null : rawNotes === null ? null : undefined;
    if (adminNotes === undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Provide adminNotes (string|null), status (claimed|confirmed|reconciled), or unlinkBracketId.',
        },
        { status: 400 },
      );
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }

    const updated = await updatePaymentAdminNotes(paymentId, adminNotes);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: paymentId, adminNotes } });
  } catch (error) {
    console.error('[PATCH /api/admin/payments/[id]] Error:', error);
    const message =
      error instanceof Error && error.message.includes('Entry cost')
        ? error.message
        : 'Failed to update payment.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/payments/[id] — Confirm a claim (admin only).
 * Body: { action: 'confirm' | 'reconcile', adminNotes?: string }
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
    const { action, adminNotes } = body as {
      action: string;
      adminNotes?: string;
    };

    if (action !== 'confirm' && action !== 'reconcile') {
      return NextResponse.json(
        { success: false, error: 'action must be "confirm".' },
        { status: 400 },
      );
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }

    const status = normalizePaymentStatus(payment.status);
    if (status === 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Rejected payments cannot be confirmed.' },
        { status: 409 },
      );
    }

    const entryCost = await requireEntryCost();
    await confirmClaimPayment(
      paymentId,
      session.user.email,
      adminNotes?.trim() || null,
      entryCost,
    );

    return NextResponse.json({ success: true, message: 'Payment confirmed.' });
  } catch (error) {
    console.error('[PUT /api/admin/payments/[id]] Error:', error);
    const message =
      error instanceof Error && error.message.includes('Entry cost')
        ? error.message
        : 'Failed to update payment.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/payments/[id] — Delete a payment claim and unlink brackets (admin only).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfProtection(_request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: paymentId } = await params;
    const deleted = await deletePayment(paymentId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Payment not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment deleted; linked brackets set to unpaid.',
    });
  } catch (error) {
    console.error('[DELETE /api/admin/payments/[id]] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete payment.' }, { status: 500 });
  }
}
