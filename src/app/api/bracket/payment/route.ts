import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { getBracketsByUserId } from '@/lib/repositories/bracketRepository';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { csrfProtection } from '@/lib/csrf';

/**
 * POST /api/bracket/payment — Create a payment request (Venmo deep-link flow).
 *
 * Body: { bracketIds: string[], additionalCount: number, additionalNote: string }
 *
 * Validates ownership and payment eligibility, then creates a `payments` row and
 * marks each selected bracket as `payment_status = 'pending'`.
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { bracketIds, additionalCount = 0, additionalNote = '' } = body as {
      bracketIds: unknown;
      additionalCount?: number;
      additionalNote?: string;
    };

    if (!Array.isArray(bracketIds) || bracketIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one bracket must be selected.' },
        { status: 400 }
      );
    }

    const addCount = Math.max(0, Math.floor(Number(additionalCount) || 0));
    if (addCount > 0 && (!additionalNote || !additionalNote.trim())) {
      return NextResponse.json(
        { success: false, error: 'A note is required when additional brackets are included.' },
        { status: 400 }
      );
    }

    const userBrackets = await getBracketsByUserId(user.id);
    const userBracketMap = new Map(userBrackets.map((b) => [b.id, b]));

    for (const bid of bracketIds) {
      const b = userBracketMap.get(bid);
      if (!b) {
        return NextResponse.json(
          { success: false, error: `Bracket ${bid} not found or does not belong to you.` },
          { status: 403 }
        );
      }
      if (b.status !== 'submitted') {
        return NextResponse.json(
          { success: false, error: `Bracket "${b.entryName}" is not in submitted status.` },
          { status: 400 }
        );
      }
      if (b.paymentStatus === 'pending' || b.paymentStatus === 'paid') {
        return NextResponse.json(
          { success: false, error: `Bracket "${b.entryName}" already has a payment (${b.paymentStatus}).` },
          { status: 409 }
        );
      }
    }

    let entryCost = 5;
    try {
      const config = await getSiteConfigFromGoogleSheets();
      if (config?.entryCost) entryCost = config.entryCost;
    } catch {
      /* fallback */
    }

    const totalItems = bracketIds.length + addCount;
    const amountCents = totalItems * entryCost * 100;

    const entryNames = bracketIds
      .map((bid: string) => userBracketMap.get(bid)?.entryName ?? bid)
      .join(', ');
    const venmoNote =
      `WMM – ${bracketIds.length} bracket${bracketIds.length > 1 ? 's' : ''} (${entryNames})` +
      (addCount > 0
        ? ` + ${addCount} additional (${additionalNote?.trim() || ''})`
        : '');

    const paymentId = crypto.randomUUID();
    const environment = getCurrentEnvironment();

    await sql`
      INSERT INTO payments (id, user_id, user_email, bracket_ids, bracket_count, additional_count,
        additional_note, amount_cents, venmo_note, status, environment)
      VALUES (${paymentId}, ${user.id}, ${user.email}, ${JSON.stringify(bracketIds)},
        ${bracketIds.length}, ${addCount}, ${additionalNote?.trim() || null},
        ${amountCents}, ${venmoNote}, 'pending', ${environment})
    `;

    for (const bid of bracketIds) {
      await sql`
        UPDATE brackets SET payment_status = 'pending', payment_id = ${paymentId}
        WHERE id = ${bid}
      `;
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId,
        amountCents,
        amountDollars: amountCents / 100,
        bracketCount: bracketIds.length,
        additionalCount: addCount,
        venmoNote,
      },
    });
  } catch (error) {
    console.error('[POST /api/bracket/payment] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment request.' },
      { status: 500 }
    );
  }
}
