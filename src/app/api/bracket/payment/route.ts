import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/logServerError';
import { ApiErrors } from '@/lib/api/responses';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { getBracketsByUserId } from '@/lib/repositories/bracketRepository';
import { createPaymentRequest } from '@/lib/repositories/paymentRepository';
import { csrfProtection } from '@/lib/csrf';
import { getActiveTournamentYear, isHistoricalYear } from '@/lib/services/tournamentYearService';
import { getMasterLockState } from '@/lib/killSwitch';
import { getPublishedVintageContent } from '@/lib/vintage/store';
import {
  buildPaymentNote,
  buildRecipientSnapshot,
  getAvailablePaymentMethods,
  normalizePaymentProviderConfig,
  type PaymentMethod,
} from '@/lib/payments/paymentProviders';

/**
 * POST /api/bracket/payment — Create a payment request (Venmo or Zelle).
 *
 * Body: {
 *   bracketIds: string[],
 *   additionalDollars: number,
 *   additionalNote: string,
 *   paymentMethod: 'venmo' | 'zelle'
 * }
 *
 * Allows additional-only payments (empty `bracketIds` when `additionalDollars` > 0).
 * Recalculates amount server-side from published Key Data entry cost.
 * Opening a provider app / “I’ve Sent” is not treated as paid — status stays pending.
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return ApiErrors.unauthorized();
    }

    const masterLock = await getMasterLockState();
    if (!masterLock.unlocked) {
      return NextResponse.json({ success: false, error: masterLock.message }, { status: 403 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const isAdminUser = await isAdmin(session.user.email);
    const home = await getPublishedVintageContent();
    const providerConfig = normalizePaymentProviderConfig(home.keyData);
    const availableMethods = getAvailablePaymentMethods(providerConfig, isAdminUser);

    if (availableMethods.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Payments are not available right now.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      bracketIds: rawBracketIds,
      additionalDollars,
      additionalCount,
      additionalNote = '',
      paymentMethod: rawMethod,
    } = body as {
      bracketIds: unknown;
      additionalDollars?: number;
      /** @deprecated Use additionalDollars — same whole-dollar meaning. */
      additionalCount?: number;
      additionalNote?: string;
      paymentMethod?: string;
    };

    const bracketIds = Array.isArray(rawBracketIds)
      ? rawBracketIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    const rawAdditional =
      additionalDollars !== undefined ? additionalDollars : additionalCount;
    const addDollars = Math.max(0, Math.floor(Number(rawAdditional) || 0));

    if (bracketIds.length === 0 && addDollars <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Select at least one bracket or include an additional payment.',
        },
        { status: 400 },
      );
    }

    if (addDollars > 0 && (!additionalNote || !additionalNote.trim())) {
      return NextResponse.json(
        { success: false, error: 'A note is required when additional payment is included.' },
        { status: 400 },
      );
    }

    const requestedMethod = (rawMethod === 'zelle' ? 'zelle' : 'venmo') as PaymentMethod;
    if (!availableMethods.includes(requestedMethod)) {
      return NextResponse.json(
        {
          success: false,
          error:
            requestedMethod === 'zelle'
              ? 'Zelle payments are not available.'
              : 'Venmo payments are not available.',
        },
        { status: 400 },
      );
    }

    const userBrackets = await getBracketsByUserId(user.id);
    const userBracketMap = new Map(userBrackets.map((b) => [b.id, b]));
    const activeYear = await getActiveTournamentYear();

    for (const bid of bracketIds) {
      const b = userBracketMap.get(bid);
      if (!b) {
        return NextResponse.json(
          { success: false, error: `Bracket ${bid} not found or does not belong to you.` },
          { status: 403 },
        );
      }
      if (isHistoricalYear(b.year, activeYear)) {
        return NextResponse.json(
          {
            success: false,
            error: `Brackets from ${b.year} are read-only. Payments apply to ${activeYear} only.`,
          },
          { status: 403 },
        );
      }
      if (b.status !== 'submitted') {
        return NextResponse.json(
          { success: false, error: `Bracket "${b.entryName}" is not in submitted status.` },
          { status: 400 },
        );
      }
      if (b.paymentStatus === 'pending' || b.paymentStatus === 'paid') {
        return NextResponse.json(
          {
            success: false,
            error: `Bracket "${b.entryName}" already has a payment (${b.paymentStatus}).`,
          },
          { status: 409 },
        );
      }
    }

    let entryCost = 5;
    if (Number.isFinite(home.keyData.entryCost) && home.keyData.entryCost >= 0) {
      entryCost = home.keyData.entryCost;
    }

    const entryAmountCents = bracketIds.length * entryCost * 100;
    const additionalAmountCents = addDollars * 100;
    const amountCents = entryAmountCents + additionalAmountCents;
    if (amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: 'Payment total must be greater than zero.' },
        { status: 400 },
      );
    }

    const entryNames = bracketIds.map(
      (bid: string) => userBracketMap.get(bid)?.entryName ?? bid,
    );
    const paymentNote = buildPaymentNote({
      entryNames,
      additionalDollars: addDollars,
      additionalNote: additionalNote?.trim() || '',
    });
    const recipientSnapshot = buildRecipientSnapshot(requestedMethod, providerConfig);

    const paymentId = crypto.randomUUID();
    const created = await createPaymentRequest({
      id: paymentId,
      userId: user.id,
      userEmail: user.email,
      bracketIds,
      additionalDollars: addDollars,
      additionalNote: additionalNote?.trim() || null,
      amountCents,
      paymentNote,
      paymentMethod: requestedMethod,
      recipientSnapshot,
      year: activeYear,
      entryCostDollars: entryCost,
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentId,
        paymentNumber: created.paymentNumber,
        year: created.year,
        amountCents,
        amountDollars: amountCents / 100,
        bracketCount: bracketIds.length,
        additionalDollars: addDollars,
        /** @deprecated Same as additionalDollars (whole dollars stored in additional_count). */
        additionalCount: addDollars,
        paymentMethod: requestedMethod,
        recipientSnapshot,
        venmoNote: paymentNote,
        paymentNote,
      },
    });
  } catch (error) {
    logServerError('POST /api/bracket/payment', error);
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/bracket/payment]', detail);
    return NextResponse.json(
      {
        success: false,
        error:
          detail.includes('does not exist') || detail.includes('relation')
            ? 'Payment storage is not ready. Refresh and try again (schema will auto-repair).'
            : 'Failed to create payment request.',
      },
      { status: 500 },
    );
  }
}
