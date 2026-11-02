/**
 * Payment request CRUD (Venmo / Zelle).
 */

import { sql } from "@/lib/databaseAdapter";
import { getCurrentEnvironment } from "@/lib/databaseConfig";
import { ensurePaymentsTables } from "@/lib/database/migrations";
import {
  computePaymentAllocation,
  normalizePaymentStatus,
  type PaymentLifecycleStatus,
} from "@/lib/payments/paymentAllocation";

let paymentsSchemaReady: Promise<void> | null = null;

/**
 * Ensure payments (+ bracket payment columns) exist before CRUD.
 */
async function ensurePaymentsSchema(): Promise<void> {
  if (!paymentsSchemaReady) {
    paymentsSchemaReady = ensurePaymentsTables().catch((error) => {
      paymentsSchemaReady = null;
      throw error;
    });
  }
  await paymentsSchemaReady;
}

/** Payment source / method recorded on a payments row. */
export type PaymentSource = "venmo" | "zelle" | "cashapp" | "credit";

/**
 * Normalize a raw payment_method column value.
 */
export function normalizePaymentSource(
  raw: string | null | undefined,
): PaymentSource {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "zelle") return "zelle";
  if (v === "cashapp" || v === "cash_app" || v === "cash app") return "cashapp";
  if (v === "credit" || v === "card") return "credit";
  return "venmo";
}

export interface PaymentRecord {
  id: string;
  /** Tournament year for the friendly sequence. */
  year: number | null;
  /** Year-scoped friendly id (admin types this). */
  paymentNumber: number | null;
  userId: string;
  userEmail: string;
  bracketIds: string[];
  bracketCount: number;
  additionalCount: number;
  additionalNote: string | null;
  amountCents: number;
  venmoNote: string | null;
  paymentMethod: PaymentSource;
  recipientSnapshot: string | null;
  /** claimed | confirmed | reconciled | rejected */
  status: PaymentLifecycleStatus;
  forceReconciled: boolean;
  requestedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  adminTransactionId: string | null;
  adminNotes: string | null;
}

interface PaymentRow {
  id: string;
  year: number | null;
  payment_number: number | null;
  user_id: string;
  user_email: string;
  bracket_ids: string[] | unknown;
  bracket_count: number;
  additional_count: number;
  additional_note: string | null;
  amount_cents: number;
  venmo_note: string | null;
  payment_method: string | null;
  recipient_snapshot: string | null;
  status: string;
  force_reconciled?: boolean | null;
  requested_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  admin_transaction_id: string | null;
  admin_notes: string | null;
}

/**
 * Normalize JSONB bracket id list from a payment row.
 */
function parseBracketIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    year: row.year == null ? null : Number(row.year),
    paymentNumber: row.payment_number == null ? null : Number(row.payment_number),
    userId: row.user_id,
    userEmail: row.user_email,
    bracketIds: parseBracketIds(row.bracket_ids),
    bracketCount: row.bracket_count,
    additionalCount: row.additional_count,
    additionalNote: row.additional_note,
    amountCents: row.amount_cents,
    venmoNote: row.venmo_note,
    paymentMethod: normalizePaymentSource(row.payment_method),
    recipientSnapshot: row.recipient_snapshot,
    status: normalizePaymentStatus(row.status),
    forceReconciled: Boolean(row.force_reconciled),
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
  /** Active tournament year for friendly numbering. */
  year: number;
  /**
   * Published entry cost (kept for callers; user Pay claims stay Claimed until
   * an admin confirms — they do not auto-reconcile on create).
   */
  entryCostDollars: number;
}

/**
 * Next friendly payment_number for environment + year.
 */
async function nextPaymentNumber(year: number): Promise<number> {
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT COALESCE(MAX(payment_number), 0) + 1 AS next
    FROM payments
    WHERE environment = ${environment} AND year = ${year}
  `;
  return Number(result.rows[0]?.next ?? 1);
}

/**
 * Insert a Claimed payment (user Pay flow) and mark selected brackets pending.
 * Stays Claimed until an admin confirms — never auto-reconciles on create.
 */
export async function createPaymentRequest(input: CreatePaymentInput): Promise<PaymentRecord> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();
  const paymentNumber = await nextPaymentNumber(input.year);
  await sql`
    INSERT INTO payments (
      id, user_id, user_email, bracket_ids, bracket_count, additional_count,
      additional_note, amount_cents, venmo_note, payment_method, recipient_snapshot,
      status, environment, year, payment_number, force_reconciled
    )
    VALUES (
      ${input.id}, ${input.userId}, ${input.userEmail}, ${JSON.stringify(input.bracketIds)},
      ${input.bracketIds.length}, ${input.additionalDollars}, ${input.additionalNote},
      ${input.amountCents}, ${input.paymentNote}, ${input.paymentMethod}, ${input.recipientSnapshot},
      'claimed', ${environment}, ${input.year}, ${paymentNumber}, FALSE
    )
  `;
  for (const bid of input.bracketIds) {
    await sql`
      UPDATE brackets SET payment_status = 'pending', payment_id = ${input.id}
      WHERE id = ${bid}
    `;
  }
  const created = await getPaymentById(input.id);
  if (!created) {
    throw new Error("Payment was created but could not be reloaded.");
  }
  return mapPayment(created);
}

/**
 * Admin payment list (newest first).
 */
export async function listPayments(filters: {
  status?: string | null;
  userEmail?: string | null;
}): Promise<PaymentRecord[]> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();
  const statusFilter = filters.status?.trim() || null;
  const emailFilter = filters.userEmail?.trim() || null;
  const result = await sql`
    SELECT * FROM payments
    WHERE environment = ${environment}
      AND (${statusFilter}::text IS NULL
        OR status = ${statusFilter}
        OR (${statusFilter} = 'claimed' AND status IN ('claimed', 'claim', 'pending'))
        OR (${statusFilter} = 'confirmed' AND status = 'confirmed')
        OR (${statusFilter} = 'reconciled' AND status = 'reconciled'))
      AND (${emailFilter}::text IS NULL OR user_email ILIKE ${"%" + (emailFilter ?? "") + "%"})
    ORDER BY requested_at DESC
    LIMIT 500
  `;
  return result.rows.map((row) => mapPayment(row as PaymentRow));
}

/**
 * Load one payment by UUID.
 */
export async function getPaymentById(id: string): Promise<PaymentRow | null> {
  await ensurePaymentsSchema();
  const existing = await sql`SELECT * FROM payments WHERE id = ${id}`;
  return (existing.rows[0] as PaymentRow | undefined) ?? null;
}

/**
 * Load payment by friendly year-scoped number.
 *
 * @param year - Tournament year
 * @param paymentNumber - Friendly id (starts at 1 each year)
 */
export async function getPaymentByNumber(
  year: number,
  paymentNumber: number,
): Promise<PaymentRow | null> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();
  const existing = await sql`
    SELECT * FROM payments
    WHERE environment = ${environment}
      AND year = ${year}
      AND payment_number = ${paymentNumber}
    LIMIT 1
  `;
  return (existing.rows[0] as PaymentRow | undefined) ?? null;
}

/**
 * Admin: attach a bracket to a payment (UUID or year+friendly number) and mark paid.
 * Claimed payments are promoted to Confirmed; exact allocation → Reconciled.
 *
 * @returns Linked payment UUID, or null when not found
 */
export async function adminLinkBracketToPayment(options: {
  bracketId: string;
  paymentUuid?: string | null;
  year?: number | null;
  paymentNumber?: number | null;
  entryCostDollars: number;
  /** Acting admin email — stamps confirmed_by when promoting Claimed → Confirmed. */
  adminEmail?: string | null;
}): Promise<{ paymentId: string } | null> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();

  let payment: PaymentRow | null = null;
  if (options.paymentUuid?.trim()) {
    payment = await getPaymentById(options.paymentUuid.trim());
  } else if (
    options.year != null &&
    options.paymentNumber != null &&
    Number.isFinite(options.paymentNumber)
  ) {
    payment = await getPaymentByNumber(options.year, Math.floor(options.paymentNumber));
  }
  if (!payment) return null;

  const bracket = await sql`
    SELECT id, payment_id FROM brackets
    WHERE id = ${options.bracketId} AND environment = ${environment}
  `;
  if (bracket.rows.length === 0) return null;

  const ids = parseBracketIds(payment.bracket_ids);
  if (!ids.includes(options.bracketId)) {
    ids.push(options.bracketId);
  }

  await sql`
    UPDATE payments
    SET bracket_ids = ${JSON.stringify(ids)},
        bracket_count = ${ids.length}
    WHERE id = ${payment.id}
  `;
  await sql`
    UPDATE brackets
    SET payment_id = ${payment.id},
        payment_status = 'paid',
        updated_at = now()
    WHERE id = ${options.bracketId} AND environment = ${environment}
  `;

  // Admin linking a Claimed payment confirms it (then auto-reconcile may finish it).
  const priorStatus = normalizePaymentStatus(payment.status);
  if (priorStatus === "claimed") {
    const adminEmail = options.adminEmail?.trim() || null;
    await sql`
      UPDATE payments
      SET status = 'confirmed',
          confirmed_at = COALESCE(confirmed_at, now()),
          confirmed_by = COALESCE(confirmed_by, ${adminEmail})
      WHERE id = ${payment.id}
    `;
  }

  await maybeAutoReconcilePayment(payment.id, options.entryCostDollars);
  return { paymentId: payment.id };
}

/**
 * Admin creates a payment with an explicit friendly # and source.
 * Optionally links one bracket. Starts Confirmed; Reconciled when allocation matches.
 */
export async function adminCreatePaymentEntry(input: {
  year: number;
  paymentNumber: number;
  userId: string;
  userEmail: string;
  /** Optional bracket to link immediately. */
  bracketId?: string | null;
  amountCents: number;
  paymentMethod: PaymentSource;
  adminEmail: string;
  entryCostDollars: number;
  note?: string | null;
}): Promise<PaymentRecord> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();
  const paymentNumber = Math.floor(input.paymentNumber);
  if (!Number.isFinite(paymentNumber) || paymentNumber < 1) {
    throw new Error("paymentNumber must be a positive integer.");
  }

  const existing = await getPaymentByNumber(input.year, paymentNumber);
  if (existing) {
    throw new Error(`Payment #${paymentNumber} already exists for ${input.year}.`);
  }

  const bracketId = input.bracketId?.trim() || null;
  const bracketIds = bracketId ? [bracketId] : [];
  const id = crypto.randomUUID();
  const amountCents = Math.max(0, Math.round(input.amountCents));
  const method = normalizePaymentSource(input.paymentMethod);
  const note = input.note?.trim() || null;
  const sourceLabel =
    method === "zelle"
      ? "Zelle"
      : method === "cashapp"
        ? "CashApp"
        : method === "credit"
          ? "Credit"
          : "Venmo";

  await sql`
    INSERT INTO payments (
      id, user_id, user_email, bracket_ids, bracket_count, additional_count,
      additional_note, amount_cents, venmo_note, payment_method, recipient_snapshot,
      status, environment, year, payment_number, force_reconciled,
      confirmed_at, confirmed_by, admin_notes
    )
    VALUES (
      ${id}, ${input.userId}, ${input.userEmail}, ${JSON.stringify(bracketIds)},
      ${bracketIds.length}, 0, NULL,
      ${amountCents}, ${note}, ${method}, ${`Admin entry (${sourceLabel})`},
      'confirmed', ${environment}, ${input.year}, ${paymentNumber}, FALSE,
      now(), ${input.adminEmail}, ${note}
    )
  `;
  if (bracketId) {
    await sql`
      UPDATE brackets
      SET payment_id = ${id},
          payment_status = 'paid',
          updated_at = now()
      WHERE id = ${bracketId} AND environment = ${environment}
    `;
  }

  await maybeAutoReconcilePayment(id, input.entryCostDollars);
  const created = await getPaymentById(id);
  if (!created) {
    throw new Error("Payment was created but could not be reloaded.");
  }
  return mapPayment(created);
}

/**
 * When linked brackets × entry cost equals the payment amount, move to reconciled.
 * If an auto-reconciled payment no longer matches, demote to confirmed/claimed.
 *
 * @param paymentId - Payment UUID
 * @param entryCostDollars - Published per-bracket entry cost
 */
export async function maybeAutoReconcilePayment(
  paymentId: string,
  entryCostDollars: number,
): Promise<void> {
  await ensurePaymentsSchema();
  const payment = await getPaymentById(paymentId);
  if (!payment) return;

  const status = normalizePaymentStatus(payment.status);
  if (status === "rejected") return;
  // User Pay claims stay Claimed until an admin confirms — never skip that step.
  if (status === "claimed") return;

  const ids = parseBracketIds(payment.bracket_ids);
  const { matchesExactly } = computePaymentAllocation(
    payment.amount_cents,
    ids.length,
    entryCostDollars,
  );

  if (matchesExactly) {
    await sql`
      UPDATE payments
      SET status = 'reconciled',
          force_reconciled = FALSE
      WHERE id = ${paymentId}
    `;
    for (const bracketId of ids) {
      await sql`
        UPDATE brackets SET payment_status = 'paid'
        WHERE id = ${bracketId} AND payment_id = ${paymentId}
      `;
    }
    return;
  }

  if (status === "reconciled" && !payment.force_reconciled) {
    const nextStatus = payment.confirmed_at ? "confirmed" : "claimed";
    await sql`
      UPDATE payments
      SET status = ${nextStatus}
      WHERE id = ${paymentId}
    `;
  }
}

/**
 * Admin sets payment lifecycle status (Claimed / Confirmed / Reconciled).
 * Reconciled with a non-zero balance is treated as forced so auto-demote won't clear it.
 *
 * @param id - Payment UUID
 * @param status - Target status
 * @param adminEmail - Acting admin
 * @param entryCostDollars - Entry cost for allocation / auto-reconcile
 * @param adminNotes - Optional notes to persist
 */
export async function updatePaymentStatus(
  id: string,
  status: "claimed" | "confirmed" | "reconciled",
  adminEmail: string,
  entryCostDollars: number,
  adminNotes?: string | null,
): Promise<PaymentRecord | null> {
  await ensurePaymentsSchema();
  const payment = await getPaymentById(id);
  if (!payment) return null;

  const ids = parseBracketIds(payment.bracket_ids);
  const { matchesExactly } = computePaymentAllocation(
    payment.amount_cents,
    ids.length,
    entryCostDollars,
  );

  let nextStatus: "claimed" | "confirmed" | "reconciled" = status;
  let forceReconciled = false;

  if (matchesExactly) {
    nextStatus = "reconciled";
    forceReconciled = false;
  } else if (status === "reconciled") {
    forceReconciled = true;
  }

  const notes =
    adminNotes === undefined ? payment.admin_notes : adminNotes?.trim() || null;

  if (nextStatus === "claimed") {
    await sql`
      UPDATE payments
      SET status = 'claimed',
          force_reconciled = FALSE,
          admin_notes = ${notes}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE payments
      SET status = ${nextStatus},
          force_reconciled = ${forceReconciled},
          confirmed_at = COALESCE(confirmed_at, now()),
          confirmed_by = COALESCE(confirmed_by, ${adminEmail}),
          admin_notes = ${notes}
      WHERE id = ${id}
    `;
  }

  if (nextStatus === "confirmed" || nextStatus === "reconciled") {
    for (const bracketId of ids) {
      await sql`
        UPDATE brackets SET payment_status = 'paid'
        WHERE id = ${bracketId} AND payment_id = ${id}
      `;
    }
  } else {
    for (const bracketId of ids) {
      await sql`
        UPDATE brackets SET payment_status = 'pending'
        WHERE id = ${bracketId} AND payment_id = ${id}
      `;
    }
  }

  const updated = await getPaymentById(id);
  return updated ? mapPayment(updated) : null;
}

/**
 * Admin confirms a Venmo/Zelle claim (checkmark). May auto-reconcile when balanced.
 */
export async function confirmClaimPayment(
  id: string,
  adminEmail: string,
  adminNotes: string | null,
  entryCostDollars: number,
): Promise<void> {
  const updated = await updatePaymentStatus(
    id,
    "confirmed",
    adminEmail,
    entryCostDollars,
    adminNotes,
  );
  if (!updated) {
    throw new Error("Payment not found.");
  }
}

/**
 * @deprecated Prefer {@link confirmClaimPayment}.
 */
export async function forceReconcilePayment(
  id: string,
  adminEmail: string,
  adminNotes: string | null,
  _transactionId: string | null,
  entryCostDollars = 5,
): Promise<void> {
  await updatePaymentStatus(id, "reconciled", adminEmail, entryCostDollars, adminNotes);
}

/**
 * @deprecated Prefer {@link confirmClaimPayment}.
 */
export async function confirmPayment(
  id: string,
  adminEmail: string,
  _transactionId: string,
  adminNotes: string | null,
  _bracketIds: string[],
  entryCostDollars = 5,
): Promise<void> {
  await confirmClaimPayment(id, adminEmail, adminNotes, entryCostDollars);
}

/**
 * Drop a bracket id from a payment's linked list (even if the bracket row is gone).
 * Clears the bracket's payment fields when the bracket still exists.
 *
 * @param paymentId - Payment UUID
 * @param bracketId - Bracket UUID to remove
 * @returns false when the payment does not exist
 */
export async function removeBracketIdFromPayment(
  paymentId: string,
  bracketId: string,
  entryCostDollars?: number,
): Promise<boolean> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();
  const payment = await getPaymentById(paymentId);
  if (!payment) return false;

  const ids = parseBracketIds(payment.bracket_ids).filter((id) => id !== bracketId);
  await sql`
    UPDATE payments
    SET bracket_ids = ${JSON.stringify(ids)},
        bracket_count = ${ids.length}
    WHERE id = ${paymentId}
  `;
  await sql`
    UPDATE brackets
    SET payment_status = NULL, payment_id = NULL, updated_at = now()
    WHERE id = ${bracketId}
      AND environment = ${environment}
      AND (payment_id = ${paymentId} OR payment_id IS NULL)
  `;
  if (entryCostDollars != null && Number.isFinite(entryCostDollars)) {
    await maybeAutoReconcilePayment(paymentId, entryCostDollars);
  }
  return true;
}

/**
 * Unlink one bracket from its payment: clear bracket paid state and drop it from
 * the payment's `bracket_ids` list (payment row itself is kept).
 *
 * @param bracketId - Bracket UUID
 * @param entryCostDollars - Optional entry cost to re-evaluate auto-reconcile
 * @returns Updated bracket, or null when the bracket does not exist
 */
export async function adminUnlinkBracketFromPayment(
  bracketId: string,
  entryCostDollars?: number,
): Promise<{ id: string; paymentStatus: string | null; paymentId: string | null } | null> {
  await ensurePaymentsSchema();
  const environment = getCurrentEnvironment();
  const bracketResult = await sql`
    SELECT id, payment_id FROM brackets
    WHERE id = ${bracketId} AND environment = ${environment}
  `;
  const bracket = bracketResult.rows[0] as { id: string; payment_id: string | null } | undefined;
  if (!bracket) return null;

  const paymentId = bracket.payment_id;
  await sql`
    UPDATE brackets
    SET payment_status = NULL, payment_id = NULL, updated_at = now()
    WHERE id = ${bracketId} AND environment = ${environment}
  `;

  if (paymentId) {
    await removeBracketIdFromPayment(paymentId, bracketId, entryCostDollars);
  }

  return { id: bracketId, paymentStatus: null, paymentId: null };
}

/**
 * Delete a payment claim and unlink every attached bracket (back to unpaid).
 *
 * @param id - Payment UUID
 * @returns false when the payment does not exist
 */
export async function deletePayment(id: string): Promise<boolean> {
  await ensurePaymentsSchema();
  const payment = await getPaymentById(id);
  if (!payment) return false;

  const ids = parseBracketIds(payment.bracket_ids);
  for (const bracketId of ids) {
    await sql`
      UPDATE brackets
      SET payment_status = NULL, payment_id = NULL, updated_at = now()
      WHERE id = ${bracketId} AND payment_id = ${id}
    `;
  }
  // Also clear any brackets that still point at this payment but are missing from bracket_ids.
  await sql`
    UPDATE brackets
    SET payment_status = NULL, payment_id = NULL, updated_at = now()
    WHERE payment_id = ${id}
  `;
  await sql`DELETE FROM payments WHERE id = ${id}`;
  return true;
}

/**
 * Update the admin comment on a payment (any status).
 *
 * @param id - Payment id
 * @param adminNotes - Comment text, or null to clear
 */
export async function updatePaymentAdminNotes(
  id: string,
  adminNotes: string | null,
): Promise<boolean> {
  await ensurePaymentsSchema();
  const result = await sql`
    UPDATE payments
    SET admin_notes = ${adminNotes}
    WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}
