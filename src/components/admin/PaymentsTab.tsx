'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, DollarSign, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { getCSRFHeaders } from '@/hooks/useCSRF';

interface BracketPaymentRow {
  id: string;
  entryName: string;
  bracketNumber: number;
  userEmail: string;
  userName: string;
  year: number;
  status: string;
  paymentStatus: string | null;
  paymentId: string | null;
}

interface PaymentRecord {
  id: string;
  userEmail: string;
  bracketIds: string[];
  bracketCount: number;
  additionalCount: number;
  additionalNote: string | null;
  amountCents: number;
  venmoNote: string | null;
  status: string;
  requestedAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  adminTransactionId: string | null;
  adminNotes: string | null;
}

type PaymentStatusFilter = 'unpaid' | 'pending' | 'confirmed';

const STATUS_LABELS: Record<PaymentStatusFilter, string> = {
  unpaid: 'Unpaid',
  pending: 'Pending',
  confirmed: 'Confirmed',
};

const STATUS_COLORS: Record<PaymentStatusFilter, { bg: string; text: string; ring: string }> = {
  unpaid: { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-300' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-300' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-300' },
};

/**
 * Resolves a bracket's paymentStatus to a normalized filter key.
 */
function resolvePaymentFilter(paymentStatus: string | null): PaymentStatusFilter {
  if (paymentStatus === 'paid') return 'confirmed';
  if (paymentStatus === 'pending') return 'pending';
  return 'unpaid';
}

type EditablePaymentValue = 'unpaid' | 'pending' | 'paid';

/**
 * Maps DB `payment_status` to the admin select value.
 */
function paymentStatusToSelectValue(paymentStatus: string | null): EditablePaymentValue {
  if (paymentStatus === 'paid') return 'paid';
  if (paymentStatus === 'pending') return 'pending';
  return 'unpaid';
}

/**
 * Case-insensitive match on entry name and user email (substring).
 */
function bracketMatchesTextQuery(b: BracketPaymentRow, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const entry = (b.entryName || '').toLowerCase();
  const email = (b.userEmail || '').toLowerCase();
  return entry.includes(q) || email.includes(q);
}

/**
 * Admin tab for reviewing bracket payment status and confirming/rejecting Venmo payments.
 */
export default function PaymentsTab() {
  const [brackets, setBrackets] = useState<BracketPaymentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const [textQuery, setTextQuery] = useState('');
  const [statusVisibility, setStatusVisibility] = useState<Record<PaymentStatusFilter, boolean>>({
    unpaid: true,
    pending: true,
    confirmed: true,
  });

  const [actionPaymentId, setActionPaymentId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'confirm' | 'reject' | null>(null);
  const [txnId, setTxnId] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [savingBracketId, setSavingBracketId] = useState<string | null>(null);
  const [bulkPanel, setBulkPanel] = useState<'confirm' | 'reject' | null>(null);
  const [bulkTxnId, setBulkTxnId] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bracketsRes, paymentsRes] = await Promise.all([
        fetch('/api/admin/brackets', { cache: 'no-store' }),
        fetch('/api/admin/payments?status=', { cache: 'no-store' }),
      ]);
      const bracketsJson = await bracketsRes.json();
      const paymentsJson = await paymentsRes.json();

      if (!bracketsRes.ok || !bracketsJson.success) throw new Error(bracketsJson.error || 'Failed to load brackets.');

      const allBrackets: BracketPaymentRow[] = (bracketsJson.data || [])
        .filter((b: Record<string, unknown>) => b.status === 'submitted')
        .map((b: Record<string, unknown>) => ({
          id: b.id as string,
          entryName: (b.entryName as string) || '',
          bracketNumber: (b.bracketNumber as number) || 0,
          userEmail: (b.userEmail as string) || '',
          userName: (b.userName as string) || '',
          year: (b.year as number) || currentYear,
          status: b.status as string,
          paymentStatus: (b.paymentStatus as string | null) ?? null,
          paymentId: (b.paymentId as string | null) ?? null,
        }));
      setBrackets(allBrackets);

      if (paymentsRes.ok && paymentsJson.success) {
        setPayments(paymentsJson.data || []);
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

  const availableYears = useMemo(() => {
    const years = new Set(brackets.map((b) => b.year));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [brackets, currentYear]);

  const filteredBrackets = useMemo(() => {
    return brackets
      .filter((b) => b.year === yearFilter)
      .filter((b) => statusVisibility[resolvePaymentFilter(b.paymentStatus)])
      .filter((b) => bracketMatchesTextQuery(b, textQuery))
      .sort((a, b) => {
        const statusOrder: Record<PaymentStatusFilter, number> = { unpaid: 0, pending: 1, confirmed: 2 };
        const diff = statusOrder[resolvePaymentFilter(a.paymentStatus)] - statusOrder[resolvePaymentFilter(b.paymentStatus)];
        if (diff !== 0) return diff;
        return a.userEmail.localeCompare(b.userEmail) || a.entryName.localeCompare(b.entryName);
      });
  }, [brackets, yearFilter, statusVisibility, textQuery]);

  const counts = useMemo(() => {
    const yearBrackets = brackets.filter((b) => b.year === yearFilter);
    return {
      unpaid: yearBrackets.filter((b) => resolvePaymentFilter(b.paymentStatus) === 'unpaid').length,
      pending: yearBrackets.filter((b) => resolvePaymentFilter(b.paymentStatus) === 'pending').length,
      confirmed: yearBrackets.filter((b) => resolvePaymentFilter(b.paymentStatus) === 'confirmed').length,
    };
  }, [brackets, yearFilter]);

  /** Look up payment record for a bracket's paymentId. */
  const getPaymentRecord = (paymentId: string | null): PaymentRecord | undefined => {
    if (!paymentId) return undefined;
    return payments.find((p) => p.id === paymentId);
  };

  const openAction = (paymentId: string, type: 'confirm' | 'reject') => {
    setActionPaymentId(paymentId);
    setActionType(type);
    setTxnId('');
    setAdminNotes('');
    setActionError(null);
  };

  const cancelAction = () => {
    setActionPaymentId(null);
    setActionType(null);
  };

  const patchBracketPaymentStatus = async (bracketId: string, paymentStatus: EditablePaymentValue) => {
    setSavingBracketId(bracketId);
    try {
      const res = await fetch(`/api/admin/brackets/${bracketId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ paymentStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Update failed.');
      setBrackets((prev) =>
        prev.map((row) =>
          row.id === bracketId
            ? {
                ...row,
                paymentStatus:
                  paymentStatus === 'unpaid'
                    ? null
                    : paymentStatus === 'pending'
                      ? 'pending'
                      : 'paid',
                paymentId: paymentStatus === 'unpaid' ? null : row.paymentId,
              }
            : row
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment status.');
    } finally {
      setSavingBracketId(null);
    }
  };

  const openBulkPanel = (action: 'confirm' | 'reject') => {
    setBulkPanel(action);
    setBulkTxnId('');
    setBulkNotes('');
    setBulkError(null);
    cancelAction();
  };

  const cancelBulkPanel = () => {
    setBulkPanel(null);
    setBulkTxnId('');
    setBulkNotes('');
    setBulkError(null);
  };

  const submitBulk = async () => {
    if (!bulkPanel) return;
    if (bulkPanel === 'confirm' && !bulkTxnId.trim()) {
      setBulkError('Transaction ID is required.');
      return;
    }
    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await fetch('/api/admin/payments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          bracketIds: filteredBrackets.map((b) => b.id),
          action: bulkPanel === 'confirm' ? 'confirm' : 'reject',
          transactionId: bulkTxnId.trim(),
          adminNotes: bulkNotes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Bulk action failed.');
      cancelBulkPanel();
      void loadData();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Bulk action failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  const submitAction = async () => {
    if (!actionPaymentId || !actionType) return;
    if (actionType === 'confirm' && !txnId.trim()) {
      setActionError('Transaction ID is required.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/payments/${actionPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({ action: actionType, transactionId: txnId.trim(), adminNotes: adminNotes.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Action failed.');
      cancelAction();
      void loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleStatus = (key: PaymentStatusFilter) => {
    setStatusVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-lg" data-testid="admin-payments-tab">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">
          <DollarSign className="mr-1 inline h-5 w-5 text-green-600" aria-hidden />
          Payments
        </h2>
        <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-none sm:flex-initial">
          <input
            type="search"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder="Search entry name or email"
            className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 sm:max-w-xs sm:flex-initial md:min-w-[14rem]"
            aria-label="Search by bracket entry name or user email"
            data-testid="payments-text-query"
          />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            data-testid="payments-year-filter"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Refresh payments"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status toggle filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as PaymentStatusFilter[]).map((key) => {
          const active = statusVisibility[key];
          const colors = STATUS_COLORS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleStatus(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-opacity ${
                colors.bg} ${colors.text} ${colors.ring} ${active ? 'opacity-100' : 'opacity-40'}`}
              data-testid={`payments-toggle-${key}`}
            >
              {STATUS_LABELS[key]}
              <span className="font-bold">{counts[key]}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={filteredBrackets.length === 0 || bulkLoading || !!bulkPanel}
            onClick={() => openBulkPanel('confirm')}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            data-testid="payments-bulk-confirm"
          >
            <Check className="h-3.5 w-3.5" />
            Confirm All Visible
          </button>
          <button
            type="button"
            disabled={filteredBrackets.length === 0 || bulkLoading || !!bulkPanel}
            onClick={() => openBulkPanel('reject')}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            data-testid="payments-bulk-reject"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject All Visible
          </button>
        </div>
        {bulkPanel && (
          <div
            className="min-w-[240px] max-w-md flex-1 rounded-lg border border-gray-300 bg-gray-50 p-3 text-left"
            data-testid="payments-bulk-panel"
          >
            <h4 className="mb-2 text-xs font-semibold text-gray-800">
              {bulkPanel === 'confirm'
                ? `Confirm all ${filteredBrackets.length} visible bracket(s)`
                : `Reject all ${filteredBrackets.length} visible bracket(s)`}
            </h4>
            {bulkPanel === 'confirm' && (
              <input
                type="text"
                value={bulkTxnId}
                onChange={(e) => setBulkTxnId(e.target.value)}
                placeholder="Transaction ID *"
                className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400"
                data-testid="payments-bulk-txn-id"
              />
            )}
            <input
              type="text"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              placeholder="Admin notes (optional)"
              className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400"
              data-testid="payments-bulk-notes"
            />
            {bulkError && <p className="mb-2 text-xs text-red-600">{bulkError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitBulk}
                disabled={bulkLoading}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50 ${
                  bulkPanel === 'confirm' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
                data-testid="payments-bulk-submit"
              >
                {bulkLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Apply
              </button>
              <button
                type="button"
                onClick={cancelBulkPanel}
                disabled={bulkLoading}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-white disabled:opacity-50"
                data-testid="payments-bulk-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && brackets.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : filteredBrackets.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No brackets match the current filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2 text-center">Payment</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBrackets.map((b) => {
                const paymentFilter = resolvePaymentFilter(b.paymentStatus);
                const colors = STATUS_COLORS[paymentFilter];
                const paymentRecord = getPaymentRecord(b.paymentId);
                const isActioning = actionPaymentId === b.paymentId;

                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">{b.entryName || `Bracket #${b.bracketNumber}`}</div>
                      <div className="text-xs text-gray-400">{String(b.bracketNumber).padStart(6, '0')}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-gray-800">{b.userName || b.userEmail}</div>
                      {b.userName && <div className="text-xs text-gray-400">{b.userEmail}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <select
                        value={paymentStatusToSelectValue(b.paymentStatus)}
                        disabled={savingBracketId === b.id || bulkLoading}
                        onChange={(e) => {
                          const v = e.target.value as EditablePaymentValue;
                          void patchBracketPaymentStatus(b.id, v);
                        }}
                        className={`max-w-[9rem] rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-900 ring-1 ${colors.ring} ${colors.bg}`}
                        aria-label={`Payment status for ${b.entryName || b.id}`}
                        data-testid={`payment-status-select-${b.id}`}
                      >
                        <option value="unpaid">{STATUS_LABELS.unpaid}</option>
                        <option value="pending">{STATUS_LABELS.pending}</option>
                        <option value="paid">{STATUS_LABELS.confirmed}</option>
                      </select>
                      {paymentRecord && (
                        <div className="mt-1 text-[10px] text-gray-400">
                          ${(paymentRecord.amountCents / 100).toFixed(0)} &middot; {fmtDate(paymentRecord.requestedAt)}
                        </div>
                      )}
                      {paymentRecord?.adminTransactionId && (
                        <div className="mt-0.5 text-[10px] text-gray-400 break-all">
                          TXN: {paymentRecord.adminTransactionId}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {paymentFilter === 'pending' && b.paymentId && !isActioning && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openAction(b.paymentId!, 'confirm')}
                            className="inline-flex items-center gap-0.5 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            <Check className="h-3 w-3" /> Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction(b.paymentId!, 'reject')}
                            className="inline-flex items-center gap-0.5 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                          >
                            <XCircle className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      )}
                      {isActioning && (
                        <div className="mt-1 rounded border border-gray-300 bg-white p-2 text-left">
                          <h4 className="mb-1 text-xs font-semibold text-gray-800">
                            {actionType === 'confirm' ? 'Confirm Payment' : 'Reject Payment'}
                          </h4>
                          {actionType === 'confirm' && (
                            <input
                              type="text"
                              value={txnId}
                              onChange={(e) => setTxnId(e.target.value)}
                              placeholder="Transaction ID *"
                              className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400"
                              data-testid="payment-action-txn-id"
                            />
                          )}
                          <input
                            type="text"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Admin notes (optional)"
                            className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400"
                          />
                          {actionError && <p className="mb-1 text-[10px] text-red-600">{actionError}</p>}
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={submitAction}
                              disabled={actionLoading}
                              className={`inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-medium text-white ${
                                actionType === 'confirm' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                              } disabled:opacity-50`}
                            >
                              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                              {actionType === 'confirm' ? 'Confirm' : 'Reject'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelAction}
                              disabled={actionLoading}
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {paymentFilter === 'unpaid' && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      {paymentFilter === 'confirmed' && (
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
    </div>
  );
}
