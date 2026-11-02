import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import {
  adminUpdateBracketPaymentStatus,
  getBracketById,
  type AdminBracketPaymentStatus,
} from '@/lib/repositories/bracketRepository';
import {
  adminLinkBracketToPayment,
  adminUnlinkBracketFromPayment,
} from '@/lib/repositories/paymentRepository';
import { csrfProtection } from '@/lib/csrf';
import { getSiteConfigCached } from '@/lib/siteConfigServer';

/**
 * PATCH /api/admin/brackets/[id]/payment — Set bracket payment link/status (admin only).
 * Body:
 * - { paymentNumber: number, year?: number } — link by friendly id (year defaults to bracket year)
 * - { paymentId: string } — link by UUID (legacy)
 * - { paymentId: null | '' } or { paymentNumber: null } — clear → unpaid
 * - { paymentStatus: 'unpaid' | 'pending' | 'paid' } — legacy status-only update
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
    const siteConfig = await getSiteConfigCached();
    const entryCost = siteConfig.entryCost;
    if (entryCost == null || !Number.isFinite(entryCost)) {
      return NextResponse.json(
        { success: false, error: 'Entry cost is not configured in published Key Data.' },
        { status: 500 }
      );
    }

    const hasPaymentNumber = Object.prototype.hasOwnProperty.call(body, 'paymentNumber');
    const hasPaymentIdKey = Object.prototype.hasOwnProperty.call(body, 'paymentId');

    if (hasPaymentNumber || hasPaymentIdKey) {
      const bracket = await getBracketById(bracketId);
      if (!bracket) {
        return NextResponse.json({ success: false, error: 'Bracket not found.' }, { status: 404 });
      }

      if (hasPaymentNumber) {
        const rawNum = (body as { paymentNumber?: unknown }).paymentNumber;
        if (rawNum === null || rawNum === '') {
          const updated = await adminUnlinkBracketFromPayment(bracketId, entryCost);
          return NextResponse.json({
            success: true,
            data: {
              id: bracketId,
              paymentStatus: updated?.paymentStatus ?? null,
              paymentId: updated?.paymentId ?? null,
            },
          });
        }
        const paymentNumber = Number(rawNum);
        if (!Number.isFinite(paymentNumber) || paymentNumber < 1) {
          return NextResponse.json(
            { success: false, error: 'paymentNumber must be a positive integer.' },
            { status: 400 }
          );
        }
        const yearRaw = (body as { year?: unknown }).year;
        const year =
          typeof yearRaw === 'number' && Number.isFinite(yearRaw)
            ? Math.floor(yearRaw)
            : bracket.year;

        const linked = await adminLinkBracketToPayment({
          bracketId,
          year,
          paymentNumber: Math.floor(paymentNumber),
          entryCostDollars: entryCost,
          adminEmail: session.user.email,
        });
        if (!linked) {
          return NextResponse.json(
            {
              success: false,
              code: 'PAYMENT_NOT_FOUND',
              error: `No payment #${Math.floor(paymentNumber)} for ${year}.`,
              data: { paymentNumber: Math.floor(paymentNumber), year, bracketId },
            },
            { status: 404 }
          );
        }
        const updated = await getBracketById(bracketId);
        return NextResponse.json({
          success: true,
          data: {
            id: bracketId,
            paymentStatus: updated?.paymentStatus ?? 'paid',
            paymentId: updated?.paymentId ?? linked.paymentId,
          },
        });
      }

      const rawId = (body as { paymentId?: unknown }).paymentId;
      const paymentId =
        typeof rawId === 'string' ? rawId.trim() : rawId === null ? '' : null;
      if (paymentId === null) {
        return NextResponse.json(
          { success: false, error: 'paymentId must be a string or null.' },
          { status: 400 }
        );
      }

      if (!paymentId) {
        const updated = await adminUnlinkBracketFromPayment(bracketId, entryCost);
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
      }

      // Numeric string → treat as friendly payment number for this bracket's year
      if (/^\d+$/.test(paymentId)) {
        const friendlyNum = Number.parseInt(paymentId, 10);
        const linked = await adminLinkBracketToPayment({
          bracketId,
          year: bracket.year,
          paymentNumber: friendlyNum,
          entryCostDollars: entryCost,
          adminEmail: session.user.email,
        });
        if (!linked) {
          return NextResponse.json(
            {
              success: false,
              code: 'PAYMENT_NOT_FOUND',
              error: `No payment #${paymentId} for ${bracket.year}.`,
              data: { paymentNumber: friendlyNum, year: bracket.year, bracketId },
            },
            { status: 404 }
          );
        }
        const updated = await getBracketById(bracketId);
        return NextResponse.json({
          success: true,
          data: {
            id: bracketId,
            paymentStatus: updated?.paymentStatus ?? 'paid',
            paymentId: updated?.paymentId ?? linked.paymentId,
          },
        });
      }

      const linked = await adminLinkBracketToPayment({
        bracketId,
        paymentUuid: paymentId,
        entryCostDollars: entryCost,
        adminEmail: session.user.email,
      });
      if (!linked) {
        return NextResponse.json(
          {
            success: false,
            code: 'PAYMENT_NOT_FOUND',
            error: 'Payment or bracket not found.',
            data: { paymentId, bracketId },
          },
          { status: 404 }
        );
      }
      const updated = await getBracketById(bracketId);
      return NextResponse.json({
        success: true,
        data: {
          id: bracketId,
          paymentStatus: updated?.paymentStatus ?? 'paid',
          paymentId: updated?.paymentId ?? linked.paymentId,
        },
      });
    }

    const raw = (body as { paymentStatus?: string }).paymentStatus;
    const allowed: AdminBracketPaymentStatus[] = ['unpaid', 'pending', 'paid'];
    if (!raw || !allowed.includes(raw as AdminBracketPaymentStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: 'paymentStatus must be unpaid, pending, or paid — or pass paymentNumber / paymentId.',
        },
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
