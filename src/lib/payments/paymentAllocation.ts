/**
 * Payment ↔ bracket allocation helpers (entry-cost math for balance).
 */

export type PaymentLifecycleStatus = 'claimed' | 'confirmed' | 'reconciled' | 'rejected';

export interface PaymentAllocation {
  /** Linked brackets × entry cost, in cents. */
  allocatedCents: number;
  /** Payment amount minus allocated (positive = leftover / tip). */
  balanceCents: number;
  /** True when allocated exactly equals payment amount. */
  matchesExactly: boolean;
}

/**
 * Compute how much of a payment is covered by linked brackets at entry cost.
 *
 * @param amountCents - Payment total in cents
 * @param linkedBracketCount - Number of brackets attached to the payment
 * @param entryCostDollars - Published per-bracket entry cost
 */
export function computePaymentAllocation(
  amountCents: number,
  linkedBracketCount: number,
  entryCostDollars: number,
): PaymentAllocation {
  const unitCents = Math.round(Number(entryCostDollars) * 100);
  const safeUnit = Number.isFinite(unitCents) && unitCents >= 0 ? unitCents : 0;
  const count = Math.max(0, Math.floor(linkedBracketCount) || 0);
  const allocatedCents = count * safeUnit;
  const amount = Number.isFinite(amountCents) ? amountCents : 0;
  return {
    allocatedCents,
    balanceCents: amount - allocatedCents,
    matchesExactly: amount > 0 && allocatedCents === amount,
  };
}

/**
 * Normalize DB payment status to Claimed / Confirmed / Reconciled (or rejected).
 * Legacy: pending|claim → claimed; confirmed stays; reconciled stays.
 *
 * @param status - Raw payments.status
 */
export function normalizePaymentStatus(
  status: string | null | undefined,
): PaymentLifecycleStatus {
  const raw = (status ?? '').trim().toLowerCase();
  if (raw === 'reconciled') return 'reconciled';
  if (raw === 'confirmed') return 'confirmed';
  if (raw === 'rejected') return 'rejected';
  // pending, claim, claimed, or unknown → claimed (user asserted they paid)
  return 'claimed';
}

/**
 * @deprecated Use {@link normalizePaymentStatus}.
 */
export function normalizePaymentClaimStatus(
  status: string | null | undefined,
): PaymentLifecycleStatus {
  return normalizePaymentStatus(status);
}

/**
 * @deprecated Use {@link normalizePaymentStatus}.
 */
export function normalizePaymentReconcileStatus(
  status: string | null | undefined,
): 'pending' | 'reconciled' | 'rejected' {
  const normalized = normalizePaymentStatus(status);
  if (normalized === 'reconciled') return 'reconciled';
  if (normalized === 'rejected') return 'rejected';
  return 'pending';
}
