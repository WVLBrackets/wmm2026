/**
 * Payment request CRUD (Venmo / Zelle).
 */

import { sql } from "@/lib/databaseAdapter";
import { getCurrentEnvironment } from "@/lib/databaseConfig";

export interface PaymentRecord {
  id: string;
  userId: string;
  userEmail: string;
  bracketIds: string[];
  bracketCount: number;
  additionalCount: number;
  additionalNote: string | null;
  amountCents: number;
  venmoNote: string | null;
  paymentMethod: "venmo" | "zelle";
  recipientSnapshot: string | null;
  status: string;
  requestedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  adminTransactionId: string | null;
  adminNotes: string | null;
}

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
  payment_method: string | null;
  recipient_snapshot: string | null;
  status: string;
  requested_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  admin_transaction_id: string | null;
  admin_notes: string | null;
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    bracketIds: row.bracket_ids,
    bracketCount: row.bracket_count,
    additionalCount: row.additional_count,
    additionalNote: row.additional_note,
    amountCents: row.amount_cents,
    venmoNote: row.venmo_note,
    paymentMethod: row.payment_method === "zelle" ? "zelle" : "venmo",
    recipientSnapshot: row.recipient_snapshot,
    status: row.status,
    requestedAt: row.requested_at,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    adminTransactionId: row.admin_transaction_id,
    adminNotes: row.admin_notes,
  };
}

export interface CreatePaymentInput {
  id: string;
  userId: string;
  userEmail: string;
  bracketIds: string[];
  additionalDollars: number;
  additionalNote: string | null;
  amountCents: number;
  paymentNote: string;
  paymentMethod: "venmo" | "zelle";
  recipientSnapshot: string;
}

/**
 * Insert a pending payment and mark selected brackets pending.
 */
export async function createPaymentRequest(input: CreatePaymentInput): Promise<void> {
  const environment = getCurrentEnvironment();
  await sql`
    INSERT INTO payments (
      id, user_id, user_email, bracket_ids, bracket_count, additional_count,
      additional_note, amount_cents, venmo_note, payment_method, recipient_snapshot,
      status, environment
    )
    VALUES (
      ${input.id}, ${input.userId}, ${input.userEmail}, ${JSON.stringify(input.bracketIds)},
      ${input.bracketIds.length}, ${input.additionalDollars}, ${input.additionalNote},
      ${input.amountCents}, ${input.paymentNote}, ${input.paymentMethod}, ${input.recipientSnapshot},
      'pending', ${environment}
    )
  `;
  for (const bid of input.bracketIds) {
    await sql`
      UPDATE brackets SET payment_status = 'pending', payment_id = ${input.id}
      WHERE id = ${bid}
    `;
  }
}

/**
 * Admin payment list (newest first).
 */
export async function listPayments(filters: {
  status?: string | null;
  userEmail?: string | null;
}): Promise<PaymentRecord[]> {
  const environment = getCurrentEnvironment();
  const statusFilter = filters.status?.trim() || null;
  const emailFilter = filters.userEmail?.trim() || null;
  const result = await sql`
    SELECT * FROM payments
    WHERE environment = ${environment}
      AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
      AND (${emailFilter}::text IS NULL OR user_email ILIKE ${"%" + (emailFilter ?? "") + "%"})
    ORDER BY requested_at DESC
    LIMIT 500
  `;
  return result.rows.map((row) => mapPayment(row as PaymentRow));
}

/**
 * Load one payment by id.
 */
export async function getPaymentById(id: string): Promise<PaymentRow | null> {
  const existing = await sql`SELECT * FROM payments WHERE id = ${id}`;
  return (existing.rows[0] as PaymentRow | undefined) ?? null;
}

/**
 * Confirm a pending payment and mark brackets paid.
 */
export async function confirmPayment(
  id: string,
  adminEmail: string,
  transactionId: string,
  adminNotes: string | null,
  bracketIds: string[],
): Promise<void> {
  await sql`
    UPDATE payments
    SET status = 'confirmed',
        confirmed_at = now(),
        confirmed_by = ${adminEmail},
        admin_transaction_id = ${transactionId},
        admin_notes = ${adminNotes}
    WHERE id = ${id}
  `;
  for (const bracketId of bracketIds) {
    await sql`
      UPDATE brackets SET payment_status = 'paid'
      WHERE id = ${bracketId} AND payment_id = ${id}
    `;
  }
}

/**
 * Reject a pending payment and clear bracket payment flags.
 */
export async function rejectPayment(
  id: string,
  adminEmail: string,
  adminNotes: string | null,
  bracketIds: string[],
): Promise<void> {
  await sql`
    UPDATE payments
    SET status = 'rejected',
        confirmed_at = now(),
        confirmed_by = ${adminEmail},
        admin_notes = ${adminNotes}
    WHERE id = ${id}
  `;
  for (const bracketId of bracketIds) {
    await sql`
      UPDATE brackets SET payment_status = NULL, payment_id = NULL
      WHERE id = ${bracketId} AND payment_id = ${id}
    `;
  }
}
