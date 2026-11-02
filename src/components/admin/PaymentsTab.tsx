'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, DollarSign, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import {
  computePaymentAllocation,
  normalizePaymentStatus,
} from '@/lib/payments/paymentAllocation';

interface BracketPaymentRow {
  id: string;
  entryName: string;
  bracketNumber: number;
  userId: string;
  userEmail: string;
  userName: string;
  year: number;
  status: string;
  paymentStatus: string | null;
  paymentId: string | null;
}

type PaymentSource = 'venmo' | 'zelle' | 'cashapp' | 'credit';

interface PaymentEntryModalState {
  /** When set, create+link that bracket (from missing-ID Apply). */
  bracketId: string | null;
  paymentNumber: string;
  year: number;
  userId: string;
  userEmail: string;
  userName: string;
  amountDollars: string;
  source: PaymentSource;
  /** True when opened from Add Payment (fields more editable). */
  standalone: boolean;
}

const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  venmo: 'Venmo',
  zelle: 'Zelle',
  cashapp: 'CashApp',
  credit: 'Credit',
};

/**
 * Display label for a payment source / method.
 */
function paymentSourceLabel(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (key === 'zelle') return PAYMENT_SOURCE_LABELS.zelle;
  if (key === 'cashapp' || key === 'cash_app') return PAYMENT_SOURCE_LABELS.cashapp;
  if (key === 'credit' || key === 'card') return PAYMENT_SOURCE_LABELS.credit;
  if (key === 'venmo') return PAYMENT_SOURCE_LABELS.venmo;
  return raw?.trim() || '—';
}

interface PaymentRecord {
  id: string;
  year: number | null;
  paymentNumber: number | null;
  userEmail: string;
  bracketIds: string[];
  bracketCount: number;
  additionalCount: number;
  additionalNote: string | null;
  amountCents: number;
  venmoNote: string | null;
  paymentMethod?: PaymentSource | string | null;
  recipientSnapshot?: string | null;
  status: string;
  forceReconciled?: boolean;
  requestedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  adminTransactionId: string | null;
  adminNotes: string | null;
}

type Lens = 'payments' | 'brackets';
type BracketStatusFilter = 'unpaid' | 'pending' | 'paid';
type PaymentStatusFilter = 'claimed' | 'confirmed' | 'reconciled';
type YearFilter = number | 'all';

const BRACKET_STATUS_LABELS: Record<BracketStatusFilter, string> = {
  unpaid: 'Unpaid',
  pending: 'Pending',
  paid: 'Paid',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatusFilter, string> = {
  claimed: 'Claimed',
  confirmed: 'Confirmed',
  reconciled: 'Reconciled',
};

const EDITABLE_PAYMENT_STATUSES: PaymentStatusFilter[] = [
  'claimed',
  'confirmed',
  'reconciled',
];

const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  unpaid: { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-300' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-300' },
  claimed: { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-300' },
  paid: { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-300' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-300' },
  reconciled: { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-300' },
};

/**
 * Bracket lens status from linked payment / bracket flags.
 */
function resolveBracketLensStatus(
  paymentStatus: string | null,
  payment: PaymentRecord | undefined,
): BracketStatusFilter {
  if (paymentStatus === 'paid') return 'paid';
  if (payment) {
    const st = normalizePaymentStatus(payment.status);
    if (st === 'confirmed' || st === 'reconciled') return 'paid';
    if (st === 'claimed') return 'pending';
    return 'unpaid';
  }
  if (paymentStatus === 'pending') return 'pending';
  return 'unpaid';
}

/**
 * Format ISO timestamp for compact admin display.
 */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Format cents as a whole-dollar admin amount.
 */
function fmtDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Case-insensitive match on entry name and user email.
 */
function bracketMatchesTextQuery(b: BracketPaymentRow, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    (b.entryName || '').toLowerCase().includes(q) ||
    (b.userEmail || '').toLowerCase().includes(q)
  );
}

/**
 * Search payments by friendly #, email, notes, linked entries.
 */
function paymentMatchesTextQuery(
  p: PaymentRecord,
  linkedEntries: string[],
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    String(p.paymentNumber ?? ''),
    p.userEmail,
    p.venmoNote ?? '',
    p.adminNotes ?? '',
    p.id,
    ...linkedEntries,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Admin Payments: payment-centric and bracket-centric lenses.
 */
export default function PaymentsTab() {
  const [lens, setLens] = useState<Lens>('payments');
  const [brackets, setBrackets] = useState<BracketPaymentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [entryCost, setEntryCost] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  /** Null until server preference loads — avoids flashing wrong year then correcting. */
  const [yearFilter, setYearFilter] = useState<YearFilter | null>(null);
  const effectiveYearFilter: YearFilter = yearFilter ?? currentYear;
  const yearFilterReady = yearFilter != null;
  const [textQuery, setTextQuery] = useState('');
  const [bracketStatusVisibility, setBracketStatusVisibility] = useState<
    Record<BracketStatusFilter, boolean>
  >({ unpaid: true, pending: true, paid: true });
  const [paymentStatusVisibility, setPaymentStatusVisibility] = useState<
    Record<PaymentStatusFilter, boolean>
  >({ claimed: true, confirmed: true, reconciled: true });

  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [unlinkingBracketId, setUnlinkingBracketId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [paymentEntryModal, setPaymentEntryModal] = useState<PaymentEntryModalState | null>(
    null,
  );
  const [paymentEntrySaving, setPaymentEntrySaving] = useState(false);
  const [paymentEntryError, setPaymentEntryError] = useState<string | null>(null);

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [paymentIdDrafts, setPaymentIdDrafts] = useState<Record<string, string>>({});
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  /** Stable Brackets-lens row order; cleared so the next filter pass re-sorts (e.g. after Apply). */
  const bracketsLensOrderRef = useRef<string[]>([]);

  const bracketsById = useMemo(() => {
    const map = new Map<string, BracketPaymentRow>();
    for (const b of brackets) map.set(b.id, b);
    return map;
  }, [brackets]);

  const paymentsById = useMemo(() => {
    const map = new Map<string, PaymentRecord>();
    for (const p of payments) map.set(p.id, p);
    return map;
  }, [payments]);

  /**
   * Friendly payment # for a bracket's linked payment (same year).
   */
  const friendlyNumberForBracket = useCallback(
    (b: BracketPaymentRow): string => {
      if (!b.paymentId) return '';
      const p = paymentsById.get(b.paymentId);
      if (p?.paymentNumber != null) return String(p.paymentNumber);
      return '';
    },
    [paymentsById],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bracketsRes, paymentsRes, siteRes] = await Promise.all([
        fetch('/api/admin/brackets', { cache: 'no-store' }),
        fetch('/api/admin/payments?status=', { cache: 'no-store' }),
        fetch('/api/site-config', { cache: 'no-store' }),
      ]);
      const bracketsJson = await bracketsRes.json();
      const paymentsJson = await paymentsRes.json();
      const siteJson = await siteRes.json().catch(() => null);

      if (siteJson?.success && siteJson?.data?.entryCost != null) {
        const cost = Number(siteJson.data.entryCost);
        if (Number.isFinite(cost)) setEntryCost(cost);
      }

      if (!bracketsRes.ok || !bracketsJson.success) {
        throw new Error(bracketsJson.error || 'Failed to load brackets.');
      }

      const allBrackets: BracketPaymentRow[] = (bracketsJson.data || [])
        .filter((b: Record<string, unknown>) => b.status === 'submitted')
        .map((b: Record<string, unknown>) => ({
          id: b.id as string,
          entryName: (b.entryName as string) || '',
          bracketNumber: (b.bracketNumber as number) || 0,
          userId: (b.userId as string) || '',
          userEmail: (b.userEmail as string) || '',
          userName: (b.userName as string) || '',
          year: (b.year as number) || currentYear,
          status: b.status as string,
          paymentStatus: (b.paymentStatus as string | null) ?? null,
          paymentId: (b.paymentId as string | null) ?? null,
        }));
      setBrackets(allBrackets);

      if (paymentsRes.ok && paymentsJson.success) {
        const rows = (paymentsJson.data || []) as PaymentRecord[];
        setPayments(rows);
        const drafts: Record<string, string> = {};
        for (const p of rows) drafts[p.id] = p.adminNotes ?? '';
        setCommentDrafts(drafts);
      } else {
        setPayments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load persisted year filter (server-side; survives sessions/devices).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/payments/preferences', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.success) {
          const raw = json.data?.yearFilter;
          if (raw === 'all') {
            setYearFilter('all');
            return;
          }
          const y = Number(raw);
          if (Number.isFinite(y)) {
            setYearFilter(y);
            return;
          }
        }
        setYearFilter(currentYear);
      } catch {
        if (!cancelled) setYearFilter(currentYear);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  /**
   * Persist year filter when the admin changes it (not on initial hydrate).
   */
  const persistYearFilter = useCallback(async (next: YearFilter) => {
    try {
      await fetch('/api/admin/payments/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ yearFilter: next }),
      });
    } catch {
      // Non-blocking: local UI still updates; next load may fall back.
    }
  }, []);

  // Keep friendly-number drafts in sync after payments/brackets load.
  useEffect(() => {
    const idDrafts: Record<string, string> = {};
    for (const b of brackets) {
      idDrafts[b.id] = friendlyNumberForBracket(b);
    }
    setPaymentIdDrafts(idDrafts);
  }, [brackets, friendlyNumberForBracket]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    if (typeof effectiveYearFilter === 'number') years.add(effectiveYearFilter);
    for (const b of brackets) years.add(b.year);
    for (const p of payments) {
      if (p.year != null) years.add(p.year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [brackets, payments, currentYear, effectiveYearFilter]);

  /**
   * Natural status/email sort for the Brackets lens.
   */
  const sortBracketsNaturally = useCallback(
    (rows: BracketPaymentRow[]) => {
      const order: Record<BracketStatusFilter, number> = { unpaid: 0, pending: 1, paid: 2 };
      return [...rows].sort((a, b) => {
        const aPay = a.paymentId ? paymentsById.get(a.paymentId) : undefined;
        const bPay = b.paymentId ? paymentsById.get(b.paymentId) : undefined;
        const diff =
          order[resolveBracketLensStatus(a.paymentStatus, aPay)] -
          order[resolveBracketLensStatus(b.paymentStatus, bPay)];
        if (diff !== 0) return diff;
        return a.userEmail.localeCompare(b.userEmail) || a.entryName.localeCompare(b.entryName);
      });
    },
    [paymentsById],
  );

  /**
   * Reset frozen Brackets row order so the next render uses natural sort (after Apply).
   */
  const resetBracketsLensOrder = useCallback(() => {
    bracketsLensOrderRef.current = [];
  }, []);

  // Year / search / status-toggle changes should re-establish order from the new result set.
  useEffect(() => {
    bracketsLensOrderRef.current = [];
  }, [effectiveYearFilter, textQuery, bracketStatusVisibility]);

  const filteredBrackets = useMemo(() => {
    const filtered = brackets
      .filter((b) => (effectiveYearFilter === 'all' ? true : b.year === effectiveYearFilter))
      .filter((b) => {
        const payment = b.paymentId ? paymentsById.get(b.paymentId) : undefined;
        return bracketStatusVisibility[resolveBracketLensStatus(b.paymentStatus, payment)];
      })
      .filter((b) => bracketMatchesTextQuery(b, textQuery));

    const natural = sortBracketsNaturally(filtered);
    if (bracketsLensOrderRef.current.length === 0) {
      bracketsLensOrderRef.current = natural.map((b) => b.id);
      return natural;
    }

    const index = new Map(bracketsLensOrderRef.current.map((id, i) => [id, i]));
    for (const b of natural) {
      if (!index.has(b.id)) {
        index.set(b.id, index.size);
        bracketsLensOrderRef.current.push(b.id);
      }
    }
    return [...natural].sort(
      (a, b) => (index.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (index.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [
    brackets,
    effectiveYearFilter,
    bracketStatusVisibility,
    textQuery,
    paymentsById,
    sortBracketsNaturally,
  ]);

  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) =>
        effectiveYearFilter === 'all'
          ? true
          : p.year != null
            ? p.year === effectiveYearFilter
            : effectiveYearFilter === currentYear,
      )
      .filter((p) => {
        const st = normalizePaymentStatus(p.status);
        if (st === 'rejected') return false;
        return paymentStatusVisibility[st];
      })
      .filter((p) => {
        const names = p.bracketIds.map((id) => bracketsById.get(id)?.entryName || id);
        return paymentMatchesTextQuery(p, names, textQuery);
      })
      .sort((a, b) => {
        const yearDiff = (b.year ?? 0) - (a.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return (b.paymentNumber ?? 0) - (a.paymentNumber ?? 0);
      });
  }, [payments, effectiveYearFilter, currentYear, paymentStatusVisibility, textQuery, bracketsById]);

  const bracketCounts = useMemo(() => {
    const yearBrackets = brackets.filter((b) =>
      effectiveYearFilter === 'all' ? true : b.year === effectiveYearFilter,
    );
    const count = (key: BracketStatusFilter) =>
      yearBrackets.filter((b) => {
        const payment = b.paymentId ? paymentsById.get(b.paymentId) : undefined;
        return resolveBracketLensStatus(b.paymentStatus, payment) === key;
      }).length;
    return { unpaid: count('unpaid'), pending: count('pending'), paid: count('paid') };
  }, [brackets, effectiveYearFilter, paymentsById]);

  const paymentCounts = useMemo(() => {
    const inYear = payments.filter((p) =>
      effectiveYearFilter === 'all'
        ? true
        : p.year != null
          ? p.year === effectiveYearFilter
          : effectiveYearFilter === currentYear,
    );
    return {
      claimed: inYear.filter((p) => normalizePaymentStatus(p.status) === 'claimed').length,
      confirmed: inYear.filter((p) => normalizePaymentStatus(p.status) === 'confirmed').length,
      reconciled: inYear.filter((p) => normalizePaymentStatus(p.status) === 'reconciled').length,
    };
  }, [payments, effectiveYearFilter, currentYear]);

  /** First five non-reconciled payments for the Brackets lens preview strip. */
  const previewPayments = useMemo(() => {
    return payments
      .filter((p) =>
        effectiveYearFilter === 'all'
          ? true
          : p.year != null
            ? p.year === effectiveYearFilter
            : effectiveYearFilter === currentYear,
      )
      .filter((p) => {
        const st = normalizePaymentStatus(p.status);
        return st === 'claimed' || st === 'confirmed';
      })
      .sort((a, b) => {
        const yearDiff = (b.year ?? 0) - (a.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return (b.paymentNumber ?? 0) - (a.paymentNumber ?? 0);
      })
      .slice(0, 5)
      .map((p) => {
        const { balanceCents } = computePaymentAllocation(
          p.amountCents,
          p.bracketIds.length,
          entryCost,
        );
        return { payment: p, balanceCents };
      });
  }, [payments, effectiveYearFilter, currentYear, entryCost]);

  const confirmPaymentClaim = async (paymentId: string) => {
    setConfirmingPaymentId(paymentId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          action: 'confirm',
          adminNotes: (commentDrafts[paymentId] ?? '').trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Confirm failed.');
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  /**
   * Admin-editable payment lifecycle status.
   */
  const savePaymentStatus = async (
    paymentId: string,
    status: PaymentStatusFilter,
  ) => {
    setStatusSavingId(paymentId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          status,
          adminNotes: (commentDrafts[paymentId] ?? '').trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Status update failed.');
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setStatusSavingId(null);
    }
  };

  const deletePaymentClaim = async (paymentId: string) => {
    const label =
      paymentsById.get(paymentId)?.paymentNumber != null
        ? `#${paymentsById.get(paymentId)!.paymentNumber}`
        : paymentId.slice(0, 8);
    if (
      !window.confirm(
        `Delete payment ${label}? Linked brackets will become Unpaid.`,
      )
    ) {
      return;
    }
    setDeletingPaymentId(paymentId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { ...(await getCSRFHeaders()) },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Delete failed.');
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  /**
   * Unlink a bracket from its payment without reloading/re-sorting the Brackets lens.
   * Row stays put; full re-sort happens on Apply.
   */
  const unlinkBracketPayment = async (bracketId: string) => {
    setUnlinkingBracketId(bracketId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brackets/${bracketId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ paymentNumber: null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to unlink payment.');

      setBrackets((prev) =>
        prev.map((b) =>
          b.id === bracketId ? { ...b, paymentId: null, paymentStatus: null } : b,
        ),
      );
      setPayments((prev) =>
        prev.map((p) => {
          if (!p.bracketIds.includes(bracketId)) return p;
          const bracketIds = p.bracketIds.filter((id) => id !== bracketId);
          return { ...p, bracketIds, bracketCount: bracketIds.length };
        }),
      );
      setPaymentIdDrafts((prev) => ({ ...prev, [bracketId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink payment.');
    } finally {
      setUnlinkingBracketId(null);
    }
  };

  /**
   * Remove a (possibly missing) bracket id from a payment's linked list.
   */
  const unlinkUnresolvedFromPayment = async (paymentId: string, bracketId: string) => {
    setUnlinkingBracketId(bracketId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ unlinkBracketId: bracketId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to remove link.');
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link.');
    } finally {
      setUnlinkingBracketId(null);
    }
  };

  /**
   * Next friendly payment # for a year (max existing + 1).
   */
  const nextPaymentNumberForYear = useCallback(
    (year: number): number => {
      let max = 0;
      for (const p of payments) {
        if (p.year === year && p.paymentNumber != null && p.paymentNumber > max) {
          max = p.paymentNumber;
        }
      }
      return max + 1;
    },
    [payments],
  );

  /** Unique users from submitted brackets (for Add Payment picker). */
  const paymentEntryUsers = useMemo(() => {
    const map = new Map<string, { userId: string; userEmail: string; userName: string }>();
    for (const b of brackets) {
      if (!b.userId || !b.userEmail) continue;
      if (!map.has(b.userId)) {
        map.set(b.userId, {
          userId: b.userId,
          userEmail: b.userEmail,
          userName: b.userName,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.userName || a.userEmail).localeCompare(b.userName || b.userEmail),
    );
  }, [brackets]);

  /**
   * Open Payment Entry when a friendly ID is not found for this year.
   */
  const openPaymentEntryModal = (
    bracket: BracketPaymentRow,
    paymentNumber: number,
    year: number,
  ) => {
    setPaymentEntryError(null);
    setPaymentEntryModal({
      bracketId: bracket.id,
      paymentNumber: String(paymentNumber),
      year,
      userId: bracket.userId,
      userEmail: bracket.userEmail,
      userName: bracket.userName,
      amountDollars: '5',
      source: 'venmo',
      standalone: false,
    });
  };

  /**
   * Open blank Payment Entry from the Add Payment button.
   */
  const openStandalonePaymentEntry = () => {
    const year =
      typeof effectiveYearFilter === 'number' ? effectiveYearFilter : currentYear;
    const firstUser = paymentEntryUsers[0];
    setPaymentEntryError(null);
    setPaymentEntryModal({
      bracketId: null,
      paymentNumber: String(nextPaymentNumberForYear(year)),
      year,
      userId: firstUser?.userId ?? '',
      userEmail: firstUser?.userEmail ?? '',
      userName: firstUser?.userName ?? '',
      amountDollars: '5',
      source: 'venmo',
      standalone: true,
    });
  };

  /**
   * Bracket rows (current filters) with a pending Payment ID draft change.
   */
  const pendingPaymentIdEdits = useMemo(() => {
    return filteredBrackets.filter((b) => {
      const draft = (paymentIdDrafts[b.id] ?? '').trim();
      return draft !== friendlyNumberForBracket(b);
    });
  }, [filteredBrackets, paymentIdDrafts, friendlyNumberForBracket]);

  /**
   * Apply one bracket Payment ID draft. Does not reload data.
   *
   * @param csrfHeaders - Shared CSRF headers for the bulk Apply pass
   */
  const linkBracketPaymentDraft = async (
    bracketId: string,
    csrfHeaders: Record<string, string>,
  ): Promise<
    | { ok: true }
    | {
        ok: false;
        code: 'PAYMENT_NOT_FOUND';
        bracket: BracketPaymentRow;
        paymentNumber: number;
        year: number;
      }
    | { ok: false; code: 'ERROR'; message: string }
  > => {
    const raw = (paymentIdDrafts[bracketId] ?? '').trim();
    const bracket = bracketsById.get(bracketId);
    if (!bracket) {
      return { ok: false, code: 'ERROR', message: 'Bracket not found.' };
    }
    const bracketYear = bracket.year ?? currentYear;
    const linkYear =
      typeof effectiveYearFilter === 'number' ? effectiveYearFilter : bracketYear;
    const body =
      raw === ''
        ? { paymentNumber: null }
        : { paymentNumber: Number.parseInt(raw, 10), year: linkYear };
    if (raw !== '' && !Number.isFinite(body.paymentNumber as number)) {
      return {
        ok: false,
        code: 'ERROR',
        message: `Payment ID for ${bracket.entryName || bracketId} must be a positive number.`,
      };
    }
    const res = await fetch(`/api/admin/brackets/${bracketId}/payment`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      if (
        res.status === 404 &&
        json.code === 'PAYMENT_NOT_FOUND' &&
        raw !== '' &&
        Number.isFinite(body.paymentNumber as number)
      ) {
        return {
          ok: false,
          code: 'PAYMENT_NOT_FOUND',
          bracket,
          paymentNumber: body.paymentNumber as number,
          year: linkYear,
        };
      }
      return {
        ok: false,
        code: 'ERROR',
        message:
          json.message ||
          json.error ||
          `Failed to link ${bracket.entryName || bracketId}.`,
      };
    }
    return { ok: true };
  };

  /**
   * Apply every pending Payment ID draft on the Brackets lens (bulk).
   */
  const applyPendingBracketPaymentIds = async () => {
    if (pendingPaymentIdEdits.length === 0) return;
    setSavingLinkId('__bulk__');
    setError(null);
    let applied = 0;
    const errors: string[] = [];
    let notFound:
      | {
          bracket: BracketPaymentRow;
          paymentNumber: number;
          year: number;
        }
      | null = null;

    try {
      const csrfHeaders = await getCSRFHeaders();
      if (Object.keys(csrfHeaders).length === 0) {
        setError('CSRF token unavailable. Refresh the page and try again.');
        return;
      }

      for (const b of pendingPaymentIdEdits) {
        const result = await linkBracketPaymentDraft(b.id, csrfHeaders);
        if (result.ok) {
          applied += 1;
          continue;
        }
        if (result.code === 'PAYMENT_NOT_FOUND') {
          if (!notFound) {
            notFound = {
              bracket: result.bracket,
              paymentNumber: result.paymentNumber,
              year: result.year,
            };
          }
          continue;
        }
        errors.push(result.message);
      }

      resetBracketsLensOrder();
      await loadData();

      if (notFound) {
        openPaymentEntryModal(
          notFound.bracket,
          notFound.paymentNumber,
          notFound.year,
        );
      }

      const parts: string[] = [];
      if (applied > 0) parts.push(`Linked ${applied} bracket${applied === 1 ? '' : 's'}.`);
      if (notFound) {
        parts.push(
          `Payment #${notFound.paymentNumber} was missing — create it in Payment Entry.`,
        );
      }
      if (errors.length > 0) {
        setError([...parts, ...errors].join(' '));
      } else if (parts.length > 0 && notFound) {
        // Soft notice via error strip is fine; keep non-blocking.
        setError(parts.join(' '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply payment IDs.');
    } finally {
      setSavingLinkId(null);
    }
  };

  /**
   * Create a new payment from the Payment Entry modal (optional bracket link).
   */
  const submitPaymentEntry = async () => {
    if (!paymentEntryModal) return;
    const amount = Number.parseFloat(paymentEntryModal.amountDollars);
    const paymentNumber = Number.parseInt(paymentEntryModal.paymentNumber, 10);
    if (!Number.isFinite(paymentNumber) || paymentNumber < 1) {
      setPaymentEntryError('Payment ID must be a positive number.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setPaymentEntryError('Amount must be a non-negative number.');
      return;
    }
    if (!paymentEntryModal.userId || !paymentEntryModal.userEmail) {
      setPaymentEntryError('Select a user for this payment.');
      return;
    }
    setPaymentEntrySaving(true);
    setPaymentEntryError(null);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          year: paymentEntryModal.year,
          paymentNumber,
          bracketId: paymentEntryModal.bracketId || undefined,
          userId: paymentEntryModal.userId,
          userEmail: paymentEntryModal.userEmail,
          amountDollars: amount,
          source: paymentEntryModal.source,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create payment.');
      }
      setPaymentEntryModal(null);
      void loadData();
    } catch (err) {
      setPaymentEntryError(err instanceof Error ? err.message : 'Failed to create payment.');
    } finally {
      setPaymentEntrySaving(false);
    }
  };

  const savePaymentComment = async (paymentId: string) => {
    setSavingCommentId(paymentId);
    setError(null);
    try {
      const notes = (commentDrafts[paymentId] ?? '').trim() || null;
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ adminNotes: notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save comment.');
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, adminNotes: notes } : p)),
      );
      setCommentDrafts((prev) => ({ ...prev, [paymentId]: notes ?? '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comment.');
    } finally {
      setSavingCommentId(null);
    }
  };

  const renderCommentEditor = (paymentId: string) => {
    const draft = commentDrafts[paymentId] ?? '';
    const saved = paymentsById.get(paymentId)?.adminNotes ?? '';
    const dirty = draft !== (saved ?? '');
    return (
      <div className="mt-1 flex flex-col gap-1" data-testid={`payment-comment-${paymentId}`}>
        <label className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Payment comment
        </label>
        <div className="flex gap-1">
          <input
            type="text"
            value={draft}
            onChange={(e) =>
              setCommentDrafts((prev) => ({ ...prev, [paymentId]: e.target.value }))
            }
            placeholder="Admin notes for this payment"
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400"
          />
          <button
            type="button"
            disabled={!dirty || savingCommentId === paymentId}
            onClick={() => void savePaymentComment(paymentId)}
            className="shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40"
          >
            {savingCommentId === paymentId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-lg" data-testid="admin-payments-tab">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">
          <DollarSign className="mr-1 inline h-5 w-5 text-green-600" aria-hidden />
          Payments
        </h2>
        <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
          <button
            type="button"
            onClick={openStandalonePaymentEntry}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            data-testid="payments-add-button"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add Payment
          </button>
          <input
            type="search"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder={
              lens === 'payments' ? 'Search #, email, note, entry' : 'Search entry or email'
            }
            className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 sm:max-w-xs sm:flex-initial"
            data-testid="payments-text-query"
          />
          <select
            value={effectiveYearFilter === 'all' ? 'all' : String(effectiveYearFilter)}
            disabled={!yearFilterReady}
            onChange={(e) => {
              const v = e.target.value;
              const next: YearFilter = v === 'all' ? 'all' : Number(v);
              setYearFilter(next);
              void persistYearFilter(next);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 disabled:opacity-60"
            data-testid="payments-year-filter"
          >
            <option value="all">All years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Refresh payments"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div
        className="mb-4 inline-flex rounded-lg border border-gray-300 p-0.5"
        role="tablist"
        aria-label="Payments view"
        data-testid="payments-lens-toggle"
      >
        <button
          type="button"
          role="tab"
          aria-selected={lens === 'payments'}
          onClick={() => setLens('payments')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            lens === 'payments' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
          data-testid="payments-lens-payments"
        >
          Payments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={lens === 'brackets'}
          onClick={() => setLens('brackets')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            lens === 'brackets' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
          data-testid="payments-lens-brackets"
        >
          Brackets
        </button>
      </div>

      {lens === 'payments' ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatusFilter[]).map((key) => {
            const active = paymentStatusVisibility[key];
            const colors = STATUS_COLORS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setPaymentStatusVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-opacity ${colors.bg} ${colors.text} ${colors.ring} ${
                  active ? 'opacity-100' : 'opacity-40'
                }`}
                data-testid={`payments-toggle-${key}`}
              >
                {PAYMENT_STATUS_LABELS[key]}
                <span className="font-bold">{paymentCounts[key]}</span>
              </button>
            );
          })}
          <span className="self-center text-xs text-gray-500">
            Entry cost {fmtDollars(Math.round(entryCost * 100))} / bracket
          </span>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(BRACKET_STATUS_LABELS) as BracketStatusFilter[]).map((key) => {
            const active = bracketStatusVisibility[key];
            const colors = STATUS_COLORS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setBracketStatusVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-opacity ${colors.bg} ${colors.text} ${colors.ring} ${
                  active ? 'opacity-100' : 'opacity-40'
                }`}
                data-testid={`brackets-toggle-${key}`}
              >
                {BRACKET_STATUS_LABELS[key]}
                <span className="font-bold">{bracketCounts[key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && brackets.length === 0 && payments.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : lens === 'payments' ? (
        filteredPayments.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No payments match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto" data-testid="payments-lens-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2">Payment ID</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Brackets</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Comment / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((p) => {
                  const statusKey = normalizePaymentStatus(p.status);
                  const colors = STATUS_COLORS[statusKey === 'rejected' ? 'unpaid' : statusKey];
                  const linked = p.bracketIds
                    .map((id) => ({ id, bracket: bracketsById.get(id) }))
                    .filter((row) => Boolean(row.bracket)) as {
                    id: string;
                    bracket: BracketPaymentRow;
                  }[];
                  const unresolvedIds = p.bracketIds.filter((id) => !bracketsById.has(id));
                  const linkedCount = p.bracketIds.length;
                  const { allocatedCents, balanceCents } = computePaymentAllocation(
                    p.amountCents,
                    linkedCount,
                    entryCost,
                  );
                  const showBalance =
                    statusKey === 'confirmed' || statusKey === 'reconciled';
                  const busy =
                    confirmingPaymentId === p.id ||
                    deletingPaymentId === p.id ||
                    statusSavingId === p.id;
                  return (
                    <tr key={p.id} className="align-top hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <div
                          className="text-lg font-bold text-gray-900"
                          data-testid={`payment-number-${p.id}`}
                        >
                          #{p.paymentNumber ?? '—'}
                          {p.year != null && effectiveYearFilter === 'all' ? (
                            <span className="ml-1 text-xs font-medium text-gray-500">
                              ({p.year})
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-gray-400">{fmtDate(p.requestedAt)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
                          data-testid={`payment-source-${p.id}`}
                        >
                          {paymentSourceLabel(p.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-base font-semibold text-gray-900">
                          {fmtDollars(p.amountCents)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Allocated {fmtDollars(allocatedCents)} ({linkedCount} ×{' '}
                          {fmtDollars(Math.round(entryCost * 100))})
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-gray-800">{p.userEmail}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {linkedCount === 0 ? (
                          <span className="text-xs text-gray-400">None linked</span>
                        ) : (
                          <ul className="space-y-1" data-testid={`payment-brackets-${p.id}`}>
                            {linked.map(({ id, bracket: b }) => (
                              <li key={id} className="flex items-center gap-1 text-gray-800">
                                <span className="min-w-0 flex-1 truncate">
                                  {b.entryName || `Bracket #${b.bracketNumber}`}
                                </span>
                                <button
                                  type="button"
                                  title="Unlink bracket"
                                  aria-label={`Unlink ${b.entryName || b.id}`}
                                  disabled={unlinkingBracketId === id}
                                  onClick={() => void unlinkBracketPayment(id)}
                                  className="shrink-0 rounded border border-gray-300 p-0.5 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                  data-testid={`payment-unlink-bracket-${id}`}
                                >
                                  {unlinkingBracketId === id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </button>
                              </li>
                            ))}
                            {unresolvedIds.map((id) => (
                              <li
                                key={id}
                                className="flex items-center gap-1 text-amber-800"
                                data-testid={`payment-unresolved-${id}`}
                              >
                                <span
                                  className="min-w-0 flex-1 truncate font-mono text-[11px]"
                                  title={id}
                                >
                                  Unresolved {id.slice(0, 8)}…
                                </span>
                                <button
                                  type="button"
                                  title="Remove unresolved link"
                                  aria-label={`Unlink unresolved ${id}`}
                                  disabled={unlinkingBracketId === id}
                                  onClick={() => void unlinkUnresolvedFromPayment(p.id, id)}
                                  className="shrink-0 rounded border border-amber-300 p-0.5 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                                  data-testid={`payment-unlink-unresolved-${id}`}
                                >
                                  {unlinkingBracketId === id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {statusKey === 'rejected' ? (
                          <span
                            className={`inline-flex rounded-lg px-2 py-1 text-xs font-medium ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}
                          >
                            Rejected
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-1">
                            <select
                              value={statusKey}
                              disabled={busy}
                              onChange={(e) =>
                                void savePaymentStatus(
                                  p.id,
                                  e.target.value as PaymentStatusFilter,
                                )
                              }
                              className={`rounded-lg border px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text} border-transparent ring-1 ${colors.ring} disabled:opacity-50`}
                              data-testid={`payment-status-${p.id}`}
                              aria-label={`Status for payment #${p.paymentNumber ?? p.id}`}
                            >
                              {EDITABLE_PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {PAYMENT_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                            {statusSavingId === p.id && (
                              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                            )}
                            {p.forceReconciled && statusKey === 'reconciled' ? (
                              <span className="text-[10px] text-gray-500">forced</span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {showBalance ? (
                          <span
                            className={`font-semibold ${
                              balanceCents === 0
                                ? 'text-gray-800'
                                : balanceCents > 0
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }`}
                            data-testid={`payment-balance-${p.id}`}
                          >
                            {fmtDollars(balanceCents)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {renderCommentEditor(p.id)}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {statusKey === 'claimed' && (
                            <button
                              type="button"
                              title="Mark confirmed"
                              aria-label={`Confirm payment #${p.paymentNumber ?? p.id}`}
                              disabled={busy}
                              onClick={() => void confirmPaymentClaim(p.id)}
                              className="inline-flex items-center gap-0.5 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              data-testid={`payment-confirm-${p.id}`}
                            >
                              {confirmingPaymentId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete payment"
                            aria-label={`Delete payment #${p.paymentNumber ?? p.id}`}
                            disabled={busy}
                            onClick={() => void deletePaymentClaim(p.id)}
                            className="inline-flex items-center gap-0.5 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            data-testid={`payment-delete-${p.id}`}
                          >
                            {deletingPaymentId === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            Enter Payment IDs on rows, then use the floating Apply button (stays visible while you
            scroll). Unlink keeps the row in place; Apply re-sorts.
          </p>

          <div
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3"
            data-testid="brackets-payment-preview"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
              Open payments (first 5 non-reconciled)
            </div>
            {previewPayments.length === 0 ? (
              <p className="text-sm text-amber-800/80">No claimed or confirmed payments in this year.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-medium uppercase tracking-wider text-amber-900/70">
                      <th className="px-2 py-1">Payment ID</th>
                      <th className="px-2 py-1">User</th>
                      <th className="px-2 py-1 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {previewPayments.map(({ payment: p, balanceCents }) => (
                      <tr key={p.id} data-testid={`brackets-preview-row-${p.id}`}>
                        <td className="px-2 py-1.5 font-semibold text-gray-900">
                          #{p.paymentNumber ?? '—'}
                          <span className="ml-1.5 text-[10px] font-medium uppercase text-amber-800/80">
                            {normalizePaymentStatus(p.status)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-gray-800">{p.userEmail}</td>
                        <td
                          className={`px-2 py-1.5 text-right font-semibold ${
                            balanceCents === 0
                              ? 'text-gray-800'
                              : balanceCents > 0
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {fmtDollars(balanceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filteredBrackets.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No brackets match the current filters.
            </p>
          ) : (
        <div className="overflow-x-auto" data-testid="brackets-lens-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Payment ID</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2">Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBrackets.map((b) => {
                const payment = b.paymentId ? paymentsById.get(b.paymentId) : undefined;
                const statusKey = resolveBracketLensStatus(b.paymentStatus, payment);
                const colors = STATUS_COLORS[statusKey];
                const draft = paymentIdDrafts[b.id] ?? '';
                const currentFriendly = friendlyNumberForBracket(b);
                return (
                  <tr key={b.id} className="align-top hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">
                        {b.entryName || `Bracket #${b.bracketNumber}`}
                      </div>
                      <div className="text-xs text-gray-400">
                        {String(b.bracketNumber).padStart(6, '0')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-gray-800">{b.userName || b.userEmail}</div>
                      {b.userName && <div className="text-xs text-gray-400">{b.userEmail}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft}
                          onChange={(e) =>
                            setPaymentIdDrafts((prev) => ({
                              ...prev,
                              [b.id]: e.target.value.replace(/[^\d]/g, ''),
                            }))
                          }
                          placeholder={
                            effectiveYearFilter === 'all'
                              ? `${b.year} #`
                              : `${effectiveYearFilter} #`
                          }
                          className={`w-24 rounded border px-2 py-1 font-mono text-sm text-gray-900 placeholder:text-gray-400 ${
                            draft !== currentFriendly
                              ? 'border-amber-400 bg-amber-50'
                              : 'border-gray-300'
                          }`}
                          data-testid={`bracket-payment-id-input-${b.id}`}
                          aria-label={`Friendly payment id for ${b.entryName || b.id}`}
                        />
                        <button
                          type="button"
                          title="Unlink payment"
                          aria-label={`Unlink payment from ${b.entryName || b.id}`}
                          disabled={!b.paymentId || unlinkingBracketId === b.id}
                          onClick={() => void unlinkBracketPayment(b.id)}
                          className="shrink-0 rounded border border-gray-300 p-1 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                          data-testid={`bracket-payment-unlink-${b.id}`}
                        >
                          {unlinkingBracketId === b.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      {payment && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          {fmtDollars(payment.amountCents)} ·{' '}
                          {paymentSourceLabel(payment.paymentMethod)} ·{' '}
                          {normalizePaymentStatus(payment.status) === 'reconciled'
                            ? 'Reconciled'
                            : normalizePaymentStatus(payment.status) === 'confirmed'
                              ? 'Confirmed'
                              : 'Claimed'}
                        </div>
                      )}
                      {!payment && b.paymentId && (
                        <div className="mt-1 text-[11px] text-amber-700">
                          Linked id unresolved — use X to clear
                        </div>
                      )}
                      {!payment && !b.paymentId && !draft && (
                        <div className="mt-1 text-[11px] text-gray-400">
                          Enter friendly Payment ID for{' '}
                          {effectiveYearFilter === 'all' ? b.year : effectiveYearFilter}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex rounded-lg px-2 py-1 text-xs font-medium ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}
                      >
                        {BRACKET_STATUS_LABELS[statusKey]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {payment ? renderCommentEditor(payment.id) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}

      {lens === 'brackets' && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex justify-end">
          <button
            type="button"
            disabled={
              pendingPaymentIdEdits.length === 0 || savingLinkId === '__bulk__'
            }
            onClick={() => void applyPendingBracketPaymentIds()}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10 hover:bg-gray-800 disabled:opacity-40"
            data-testid="brackets-apply-payment-ids"
          >
            {savingLinkId === '__bulk__' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            Apply
            {pendingPaymentIdEdits.length > 0
              ? ` (${pendingPaymentIdEdits.length})`
              : ''}
          </button>
        </div>
      )}

      {paymentEntryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-entry-title"
          data-testid="payment-entry-modal"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3
              id="payment-entry-title"
              className="text-lg font-semibold text-gray-900"
            >
              Payment Entry
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {paymentEntryModal.standalone
                ? 'Create a new payment for the selected year and user.'
                : `No payment #${paymentEntryModal.paymentNumber} for ${paymentEntryModal.year}. Create one and link this bracket.`}
            </p>

            <div className="mt-4 space-y-3">
              {paymentEntryModal.standalone && (
                <div>
                  <label
                    htmlFor="payment-entry-year"
                    className="block text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    Year
                  </label>
                  <select
                    id="payment-entry-year"
                    value={paymentEntryModal.year}
                    onChange={(e) => {
                      const year = Number(e.target.value);
                      setPaymentEntryModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              year,
                              paymentNumber: String(nextPaymentNumberForYear(year)),
                            }
                          : prev,
                      );
                    }}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    data-testid="payment-entry-year"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="payment-entry-number"
                  className="block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Payment ID
                </label>
                {paymentEntryModal.standalone ? (
                  <input
                    id="payment-entry-number"
                    type="number"
                    min={1}
                    step={1}
                    value={paymentEntryModal.paymentNumber}
                    onChange={(e) =>
                      setPaymentEntryModal((prev) =>
                        prev ? { ...prev, paymentNumber: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
                    data-testid="payment-entry-number"
                  />
                ) : (
                  <div className="mt-1 font-mono text-base font-semibold text-gray-900">
                    #{paymentEntryModal.paymentNumber}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({paymentEntryModal.year})
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="payment-entry-user"
                  className="block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  User
                </label>
                {paymentEntryModal.standalone ? (
                  <select
                    id="payment-entry-user"
                    value={paymentEntryModal.userId}
                    onChange={(e) => {
                      const user = paymentEntryUsers.find((u) => u.userId === e.target.value);
                      setPaymentEntryModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              userId: user?.userId ?? '',
                              userEmail: user?.userEmail ?? '',
                              userName: user?.userName ?? '',
                            }
                          : prev,
                      );
                    }}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    data-testid="payment-entry-user"
                  >
                    {paymentEntryUsers.length === 0 ? (
                      <option value="">No users with brackets</option>
                    ) : (
                      paymentEntryUsers.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {(u.userName || u.userEmail) + (u.userName ? ` (${u.userEmail})` : '')}
                        </option>
                      ))
                    )}
                  </select>
                ) : (
                  <>
                    <div className="mt-1 text-sm text-gray-900">
                      {paymentEntryModal.userName || paymentEntryModal.userEmail}
                    </div>
                    {paymentEntryModal.userName ? (
                      <div className="text-xs text-gray-500">{paymentEntryModal.userEmail}</div>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <label
                  htmlFor="payment-entry-amount"
                  className="block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Amount ($)
                </label>
                <input
                  id="payment-entry-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={paymentEntryModal.amountDollars}
                  onChange={(e) =>
                    setPaymentEntryModal((prev) =>
                      prev ? { ...prev, amountDollars: e.target.value } : prev,
                    )
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  data-testid="payment-entry-amount"
                />
              </div>

              <div>
                <label
                  htmlFor="payment-entry-source"
                  className="block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Source
                </label>
                <select
                  id="payment-entry-source"
                  value={paymentEntryModal.source}
                  onChange={(e) =>
                    setPaymentEntryModal((prev) =>
                      prev
                        ? { ...prev, source: e.target.value as PaymentSource }
                        : prev,
                    )
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  data-testid="payment-entry-source"
                >
                  {(Object.keys(PAYMENT_SOURCE_LABELS) as PaymentSource[]).map((s) => (
                    <option key={s} value={s}>
                      {PAYMENT_SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {paymentEntryError && (
                <p className="text-sm text-red-600" data-testid="payment-entry-error">
                  {paymentEntryError}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={paymentEntrySaving}
                onClick={() => setPaymentEntryModal(null)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                data-testid="payment-entry-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentEntrySaving}
                onClick={() => void submitPaymentEntry()}
                className="inline-flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                data-testid="payment-entry-save"
              >
                {paymentEntrySaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {paymentEntryModal.bracketId ? 'Create & link' : 'Create payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
