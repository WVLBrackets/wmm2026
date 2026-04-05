'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DollarSign, ExternalLink, Loader2, Minus, Plus, X } from 'lucide-react';
import { getCSRFHeaders } from '@/hooks/useCSRF';

interface PayableBracket {
  id: string;
  entryName: string;
  bracketNumber?: number;
}

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Submitted brackets with no existing payment (paymentStatus null/undefined). */
  unpaidBrackets: PayableBracket[];
  entryCost: number;
  venmoUser: string;
  /** Called after payment request is recorded so the parent can refresh bracket list. */
  onPaymentCreated: () => void;
}

/**
 * Modal for initiating a Venmo payment for one or more brackets plus optional additional entries.
 */
export default function PaymentModal({
  isOpen,
  onClose,
  unpaidBrackets,
  entryCost,
  venmoUser,
  onPaymentCreated,
}: PaymentModalProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [additionalCount, setAdditionalCount] = useState(0);
  const [additionalNote, setAdditionalNote] = useState('');
  const [step, setStep] = useState<'select' | 'confirming' | 'done' | 'error'>('select');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const prevOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setCheckedIds(new Set(unpaidBrackets.map((b) => b.id)));
      setAdditionalCount(0);
      setAdditionalNote('');
      setStep('select');
      setErrorMsg('');
    }
    prevOpen.current = isOpen;
  }, [isOpen, unpaidBrackets]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const toggleBracket = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalItems = checkedIds.size + additionalCount;
  const totalDollars = totalItems * entryCost;

  const canPay = totalItems > 0 && (additionalCount === 0 || additionalNote.trim().length > 0);

  /** Build Venmo deep-link URL. */
  const buildVenmoUrl = useCallback(() => {
    const entryNames = unpaidBrackets
      .filter((b) => checkedIds.has(b.id))
      .map((b) => b.entryName)
      .join(', ');
    let note = `WMM – ${checkedIds.size} bracket${checkedIds.size !== 1 ? 's' : ''} (${entryNames})`;
    if (additionalCount > 0) {
      note += ` + ${additionalCount} additional (${additionalNote.trim()})`;
    }
    const params = new URLSearchParams({
      txn: 'pay',
      amount: String(totalDollars),
      note,
    });
    const username = venmoUser.replace(/^@/, '');
    return `https://venmo.com/${username}?${params.toString()}`;
  }, [checkedIds, unpaidBrackets, additionalCount, additionalNote, totalDollars, venmoUser]);

  const handlePayWithVenmo = () => {
    if (!canPay) return;
    window.open(buildVenmoUrl(), '_blank');
    setStep('confirming');
  };

  const handleConfirmSent = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/bracket/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          bracketIds: Array.from(checkedIds),
          additionalCount,
          additionalNote: additionalNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Payment request failed.');
      }
      setStep('done');
      onPaymentCreated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={onClose}
      data-testid="payment-modal"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="payment-modal-title" className="text-lg font-semibold text-gray-900">
            <DollarSign className="mr-1.5 inline h-5 w-5 text-green-600" aria-hidden />
            Make a Payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* Step: select brackets */}
          {(step === 'select' || step === 'confirming') && (
            <>
              {/* Bracket checkboxes */}
              <fieldset>
                {unpaidBrackets.length === 0 && (
                  <p className="text-sm italic text-gray-500">No unpaid brackets to pay for.</p>
                )}
                <div className="space-y-1.5">
                  {unpaidBrackets.map((b) => (
                    <label
                      key={b.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2 transition hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checkedIds.has(b.id)}
                        onChange={() => toggleBracket(b.id)}
                        disabled={step === 'confirming'}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        data-testid={`payment-bracket-checkbox-${b.id}`}
                      />
                      <span className="flex-1 text-sm text-gray-800">{b.entryName || `Bracket #${b.bracketNumber}`}</span>
                      <span className="text-xs text-gray-500">${entryCost}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Additional brackets */}
              <div className="mt-4 rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="additional-count" className="text-sm font-medium text-gray-700">
                    Additional Brackets
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAdditionalCount((c) => Math.max(0, c - 1))}
                      disabled={additionalCount <= 0 || step === 'confirming'}
                      className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="Decrease additional brackets"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      id="additional-count"
                      type="number"
                      min={0}
                      step={1}
                      value={additionalCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setAdditionalCount(Number.isFinite(v) && v >= 0 ? v : 0);
                      }}
                      disabled={step === 'confirming'}
                      className="w-14 rounded-md border border-gray-300 px-2 py-1 text-center text-sm text-gray-900"
                      data-testid="payment-additional-count"
                    />
                    <button
                      type="button"
                      onClick={() => setAdditionalCount((c) => c + 1)}
                      disabled={step === 'confirming'}
                      className="rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="Increase additional brackets"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Note field */}
                <div className="mt-2">
                  <label htmlFor="additional-note" className="block text-xs text-gray-600">
                    Note {additionalCount > 0 && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    id="additional-note"
                    type="text"
                    value={additionalNote}
                    onChange={(e) => setAdditionalNote(e.target.value)}
                    disabled={additionalCount === 0 || step === 'confirming'}
                    readOnly={additionalCount === 0}
                    placeholder={additionalCount === 0 ? '' : 'e.g. Family entries, future bracket, tip'}
                    className={`mt-1 w-full rounded-md border px-3 py-1.5 text-sm ${
                      additionalCount === 0
                        ? 'border-gray-200 bg-gray-50 text-gray-400'
                        : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'
                    }`}
                    data-testid="payment-additional-note"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="mt-4 flex items-baseline justify-between border-t border-gray-200 pt-3">
                <span className="text-sm font-medium text-gray-700">
                  {totalItems} bracket{totalItems !== 1 ? 's' : ''} × ${entryCost}
                </span>
                <span className="text-xl font-bold text-gray-900">${totalDollars}</span>
              </div>
            </>
          )}

          {/* Confirming step */}
          {step === 'confirming' && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-sm text-blue-800">
                A Venmo window should have opened. After you complete the payment there, come back and confirm below.
              </p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
              <DollarSign className="mx-auto mb-2 h-10 w-10 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Payment request recorded! Your brackets are marked as &ldquo;Payment Pending&rdquo; until the admin confirms.
              </p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm text-red-700">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          {step === 'select' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayWithVenmo}
                disabled={!canPay}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#008CFF] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0074D4] disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="payment-venmo-button"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Pay ${totalDollars} with Venmo
              </button>
            </>
          )}

          {step === 'confirming' && (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                disabled={submitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmSent}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                data-testid="payment-confirm-sent"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                I&apos;ve Sent the Payment
              </button>
            </>
          )}

          {(step === 'done' || step === 'error') && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
