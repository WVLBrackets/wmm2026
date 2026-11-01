'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Minus, Plus, X } from 'lucide-react';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import {
  buildPaymentNote,
  getZelleRecipient,
  normalizePaymentProviderConfig,
  type PaymentMethod,
  type PaymentProviderConfig,
} from '@/lib/payments/paymentProviders';
import './PaymentModal.css';

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
  /** Full payment provider config from site-config / Key Data. */
  paymentConfig: PaymentProviderConfig;
  /** Methods available for this user after master + recipient checks. */
  availableMethods: PaymentMethod[];
  /** Called after payment request is recorded so the parent can refresh bracket list. */
  onPaymentCreated: () => void;
}

type SlipStep = 'select' | 'zelle' | 'confirming' | 'done' | 'error';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Soft ceiling for typed/stepper additional payment (whole dollars). */
const MAX_ADDITIONAL_DOLLARS = 9999;

/**
 * Format a dollar amount for display (whole dollars as used by entry cost).
 */
function formatPaymentDollars(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/**
 * Parse a non-negative whole-dollar amount from a number input value.
 */
function parseAdditionalDollars(raw: string): number {
  if (raw.trim() === '') return 0;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_ADDITIONAL_DOLLARS, value);
}

/**
 * Modal for initiating Venmo / Zelle payment for selected brackets and/or extra dollars.
 * Visual: Option 2 — Payment Slip (navy/cream/red). Provider buttons are equal navy choices.
 *
 * Prefer mounting only while open (parent `{isOpen && <PaymentModal … />}`) so each
 * open starts with a fresh form. `isOpen` remains supported for compatibility.
 */
export default function PaymentModal({
  isOpen,
  onClose,
  unpaidBrackets,
  entryCost,
  paymentConfig: paymentConfigProp,
  availableMethods,
  onPaymentCreated,
}: PaymentModalProps) {
  const titleId = useId();
  const summaryLiveId = useId();
  const paymentConfig = useMemo(
    () => normalizePaymentProviderConfig(paymentConfigProp),
    [paymentConfigProp],
  );
  const zelleRecipient = useMemo(() => getZelleRecipient(paymentConfig), [paymentConfig]);
  const showVenmo = availableMethods.includes('venmo');
  const showZelle = availableMethods.includes('zelle');
  const dualMethods = showVenmo && showZelle;

  const [checkedIds, setCheckedIds] = useState(
    () => new Set(unpaidBrackets.map((b) => b.id)),
  );
  const [additionalDollars, setAdditionalDollars] = useState(0);
  const [additionalNote, setAdditionalNote] = useState('');
  const [step, setStep] = useState<SlipStep>('select');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  /**
   * Move focus into the dialog on mount; return it to the opener on unmount.
   */
  useLayoutEffect(() => {
    if (!isOpen) return;
    const prior =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();
    return () => {
      prior?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, submitting]);

  const toggleBracket = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const entryDollars = checkedIds.size * entryCost;
  const totalDollars = entryDollars + additionalDollars;
  const formattedTotal = formatPaymentDollars(totalDollars);
  const formattedUnit = formatPaymentDollars(entryCost);
  const formattedAdditional = formatPaymentDollars(additionalDollars);

  const paymentNote = useMemo(() => {
    const entryNames = unpaidBrackets
      .filter((b) => checkedIds.has(b.id))
      .map((b) => b.entryName);
    return buildPaymentNote({
      entryNames,
      additionalDollars,
      additionalNote: additionalNote.trim(),
    });
  }, [checkedIds, unpaidBrackets, additionalDollars, additionalNote]);

  const canPay =
    totalDollars > 0 &&
    (checkedIds.size > 0 || additionalDollars > 0) &&
    (additionalDollars === 0 || additionalNote.trim().length > 0);

  const formLocked = step === 'confirming' || step === 'zelle' || submitting;

  /** Build Venmo deep-link URL (unchanged construction). */
  const buildVenmoUrl = useCallback(() => {
    const params = new URLSearchParams({
      txn: 'pay',
      amount: String(totalDollars),
      note: paymentNote,
    });
    const username = paymentConfig.venmoUser.replace(/^@/, '');
    return `https://venmo.com/${username}?${params.toString()}`;
  }, [paymentConfig.venmoUser, totalDollars, paymentNote]);

  /**
   * Copy text to clipboard and flash a short “Copied” affordance.
   *
   * @param field - Stable field key for feedback
   * @param value - Clipboard payload
   */
  const copyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1600);
    } catch {
      setCopiedField(null);
    }
  };

  const handlePayWithVenmo = () => {
    if (!canPay || submitting || !showVenmo) return;
    setSelectedMethod('venmo');
    window.open(buildVenmoUrl(), '_blank');
    setStep('confirming');
  };

  const handlePayWithZelle = () => {
    if (!canPay || submitting || !showZelle) return;
    setSelectedMethod('zelle');
    setStep('zelle');
  };

  const handleConfirmSent = async () => {
    if (submitting || !selectedMethod) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/bracket/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getCSRFHeaders()) },
        body: JSON.stringify({
          bracketIds: Array.from(checkedIds),
          additionalDollars,
          additionalNote: additionalNote.trim(),
          paymentMethod: selectedMethod,
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

  const summaryCalc =
    additionalDollars > 0
      ? `${checkedIds.size} bracket${checkedIds.size !== 1 ? 's' : ''} × $${formattedUnit} + $${formattedAdditional}`
      : `${checkedIds.size} bracket${checkedIds.size !== 1 ? 's' : ''} × $${formattedUnit}`;
  const summaryText = `${summaryCalc}. Total $${formattedTotal}.`;
  const showSelectBody = step === 'select' || step === 'confirming';
  const showZelleQr =
    Boolean(zelleRecipient) &&
    paymentConfig.zelleQrEnabled &&
    Boolean(paymentConfig.zelleQrImageSrc.trim());

  return (
    <div
      className="pm-slip-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      data-testid="payment-modal"
    >
      <div
        ref={dialogRef}
        className="pm-slip"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="pm-slip__header">
          <div>
            <p className="pm-slip__brand">Warren&apos;s March Madness</p>
            <h2 id={titleId} className="pm-slip__title">
              Entry Payment
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="pm-slip__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close payment dialog"
            data-testid="payment-modal-close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="pm-slip__body">
          {showSelectBody && (
            <>
              <div className="pm-slip__section-head">
                <p className="pm-slip__label" id="pm-select-entries-label">
                  Select Entries
                </p>
                <p className="pm-slip__price-tag">${formattedUnit} per entry</p>
              </div>

              <fieldset className="pm-slip__entries" aria-labelledby="pm-select-entries-label">
                <legend className="pm-slip__entries-legend">Unpaid submitted entries</legend>
                {unpaidBrackets.length === 0 && (
                  <p className="pm-slip__empty">
                    No unpaid brackets — you can still send an additional payment below.
                  </p>
                )}
                {unpaidBrackets.map((b) => {
                  const name = b.entryName || `Bracket #${b.bracketNumber}`;
                  const inputId = `payment-bracket-${b.id}`;
                  return (
                    <div key={b.id} className="pm-slip__entry">
                      <input
                        id={inputId}
                        type="checkbox"
                        className="pm-slip__checkbox"
                        checked={checkedIds.has(b.id)}
                        onChange={() => toggleBracket(b.id)}
                        disabled={formLocked}
                        data-testid={`payment-bracket-checkbox-${b.id}`}
                      />
                      <label className="pm-slip__entry-name" htmlFor={inputId}>
                        {name}
                      </label>
                      <span className="pm-slip__entry-price" aria-hidden="true">
                        ${formattedUnit}
                      </span>
                    </div>
                  );
                })}
              </fieldset>

              <div className="pm-slip__extra">
                <div className="pm-slip__stepper-row">
                  <label htmlFor="additional-dollars" className="pm-slip__label">
                    Additional Payment
                  </label>
                  <div className="pm-slip__stepper">
                    <button
                      type="button"
                      className="pm-slip__stepper-btn"
                      onClick={() => setAdditionalDollars((c) => Math.max(0, c - 1))}
                      disabled={additionalDollars <= 0 || formLocked}
                      aria-label="Decrease additional payment by one dollar"
                      data-testid="payment-additional-minus"
                    >
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <div className="pm-slip__dollar-field">
                      <span className="pm-slip__dollar-prefix" aria-hidden="true">
                        $
                      </span>
                      <input
                        id="additional-dollars"
                        type="number"
                        className="pm-slip__stepper-input"
                        min={0}
                        max={MAX_ADDITIONAL_DOLLARS}
                        step={1}
                        inputMode="numeric"
                        value={additionalDollars}
                        onChange={(e) =>
                          setAdditionalDollars(parseAdditionalDollars(e.target.value))
                        }
                        disabled={formLocked}
                        aria-label="Additional payment in dollars"
                        data-testid="payment-additional-dollars"
                      />
                    </div>
                    <button
                      type="button"
                      className="pm-slip__stepper-btn"
                      onClick={() =>
                        setAdditionalDollars((c) =>
                          Math.min(MAX_ADDITIONAL_DOLLARS, c + 1),
                        )
                      }
                      disabled={
                        additionalDollars >= MAX_ADDITIONAL_DOLLARS || formLocked
                      }
                      aria-label="Increase additional payment by one dollar"
                      data-testid="payment-additional-plus"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="pm-slip__note-field">
                  <label htmlFor="additional-note" className="pm-slip__note-label">
                    Note
                    {additionalDollars > 0 ? (
                      <span className="pm-slip__required" aria-hidden>
                        {' '}
                        *
                      </span>
                    ) : null}
                  </label>
                  <input
                    id="additional-note"
                    type="text"
                    className="pm-slip__note-input"
                    value={additionalNote}
                    onChange={(e) => setAdditionalNote(e.target.value)}
                    disabled={additionalDollars === 0 || formLocked}
                    readOnly={additionalDollars === 0}
                    placeholder={
                      additionalDollars === 0
                        ? ''
                        : 'e.g. Tip, family entries, donation'
                    }
                    aria-required={additionalDollars > 0}
                    data-testid="payment-additional-note"
                  />
                </div>
              </div>
            </>
          )}

          {step === 'zelle' && zelleRecipient && (
            <div className="pm-slip__zelle" data-testid="payment-zelle-instructions">
              <p className="pm-slip__label">Zelle instructions</p>
              <p className="pm-slip__zelle-lead">
                Open Zelle in your banking app, verify the recipient, and send the amount
                shown. Then return here to confirm.
              </p>

              {showZelleQr ? (
                <div className="pm-slip__zelle-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- CMS/FPO URL may be external or SVG */}
                  <img
                    src={paymentConfig.zelleQrImageSrc}
                    alt="Zelle recipient QR code"
                    className="pm-slip__zelle-qr-img"
                    data-testid="payment-zelle-qr"
                  />
                </div>
              ) : null}

              <div className="pm-slip__copy-rows">
                <div className="pm-slip__copy-row">
                  <div className="pm-slip__copy-meta">
                    <span className="pm-slip__copy-label">Recipient</span>
                    <span className="pm-slip__copy-value" data-testid="payment-zelle-recipient-name">
                      {zelleRecipient.displayName}
                    </span>
                    <span className="pm-slip__copy-sub" data-testid="payment-zelle-recipient-contact">
                      {zelleRecipient.contact}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pm-slip__copy-btn"
                    onClick={() => void copyField('contact', zelleRecipient.contact)}
                    data-testid="payment-zelle-copy-contact"
                  >
                    {copiedField === 'contact' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {copiedField === 'contact' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="pm-slip__copy-row">
                  <div className="pm-slip__copy-meta">
                    <span className="pm-slip__copy-label">Amount</span>
                    <span className="pm-slip__copy-value" data-testid="payment-zelle-amount">
                      ${formattedTotal}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pm-slip__copy-btn"
                    onClick={() => void copyField('amount', String(totalDollars))}
                    data-testid="payment-zelle-copy-amount"
                  >
                    {copiedField === 'amount' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {copiedField === 'amount' ? 'Copied' : 'Copy Amount'}
                  </button>
                </div>

                <div className="pm-slip__copy-row">
                  <div className="pm-slip__copy-meta">
                    <span className="pm-slip__copy-label">Note</span>
                    <span className="pm-slip__copy-value pm-slip__copy-value--wrap" data-testid="payment-zelle-note">
                      {paymentNote}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="pm-slip__copy-btn"
                    onClick={() => void copyField('note', paymentNote)}
                    data-testid="payment-zelle-copy-note"
                  >
                    {copiedField === 'note' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {copiedField === 'note' ? 'Copied' : 'Copy Note'}
                  </button>
                </div>
              </div>

              <p className="pm-slip__zelle-disclaimer">
                Reporting payment creates a pending request for admin verification — it is not
                proof of receipt.
              </p>
            </div>
          )}

          {step === 'confirming' && (
            <div className="pm-slip__status pm-slip__status--confirm" role="status">
              <p>
                {selectedMethod === 'zelle'
                  ? 'After you send the Zelle payment in your banking app, come back and confirm below. Reporting payment is not proof that payment succeeded.'
                  : 'A Venmo window should have opened. After you complete the payment there, come back and confirm below. Opening Venmo is not proof that payment succeeded.'}
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="pm-slip__status pm-slip__status--done" role="status">
              <p>
                Payment request recorded! Your brackets are marked as &ldquo;Payment Pending&rdquo;
                until the admin confirms.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="pm-slip__status pm-slip__status--error" role="alert">
              <p>{errorMsg}</p>
              <button
                type="button"
                className="pm-slip__retry"
                onClick={() => {
                  setSelectedMethod(null);
                  setStep('select');
                }}
                data-testid="payment-try-again"
              >
                Try Again
              </button>
            </div>
          )}

          <p id={summaryLiveId} className="pm-slip__sr-live" aria-live="polite" aria-atomic="true">
            {step === 'select' || step === 'confirming' || step === 'zelle' ? summaryText : ''}
          </p>
        </div>

        <footer className="pm-slip__footer">
          {(step === 'select' || step === 'confirming' || step === 'zelle') && (
            <div className="pm-slip__summary">
              <div className="pm-slip__summary-copy">
                <p className="pm-slip__summary-title">Payment Summary</p>
                <p className="pm-slip__summary-calc">{summaryCalc}</p>
              </div>
              <div className="pm-slip__total-block">
                <p className="pm-slip__total-label">Total</p>
                <p className="pm-slip__total-amount" data-testid="payment-total">
                  ${formattedTotal}
                </p>
              </div>
            </div>
          )}

          <div className="pm-slip__actions">
            {step === 'select' && (
              <>
                <button
                  type="button"
                  className="pm-slip__btn pm-slip__btn--cancel"
                  onClick={onClose}
                  data-testid="payment-cancel"
                >
                  Cancel
                </button>
                <div
                  className={`pm-slip__method-block${dualMethods ? ' pm-slip__method-block--dual' : ''}`}
                >
                  <p className="pm-slip__method-label" id="pm-choose-method-label">
                    Choose payment method
                  </p>
                  <div
                    className="pm-slip__method-row"
                    role="group"
                    aria-labelledby="pm-choose-method-label"
                  >
                    {showVenmo ? (
                      <button
                        type="button"
                        className="pm-slip__btn pm-slip__btn--method"
                        onClick={handlePayWithVenmo}
                        disabled={!canPay}
                        data-testid="payment-venmo-button"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        Pay ${formattedTotal} with Venmo
                      </button>
                    ) : null}
                    {showZelle ? (
                      <button
                        type="button"
                        className="pm-slip__btn pm-slip__btn--method"
                        onClick={handlePayWithZelle}
                        disabled={!canPay}
                        data-testid="payment-zelle-button"
                      >
                        Pay ${formattedTotal} with Zelle
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            {step === 'zelle' && (
              <>
                <button
                  type="button"
                  className="pm-slip__btn pm-slip__btn--cancel"
                  onClick={() => {
                    setSelectedMethod(null);
                    setStep('select');
                  }}
                  disabled={submitting}
                  data-testid="payment-zelle-back"
                >
                  Back
                </button>
                <button
                  type="button"
                  className="pm-slip__btn pm-slip__btn--confirm"
                  onClick={() => void handleConfirmSent()}
                  disabled={submitting}
                  data-testid="payment-zelle-sent"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  I&apos;ve Sent the Payment
                </button>
              </>
            )}

            {step === 'confirming' && (
              <>
                <button
                  type="button"
                  className="pm-slip__btn pm-slip__btn--cancel"
                  onClick={() => setStep('select')}
                  disabled={submitting}
                  data-testid="payment-back"
                >
                  Back
                </button>
                <button
                  type="button"
                  className="pm-slip__btn pm-slip__btn--confirm"
                  onClick={() => void handleConfirmSent()}
                  disabled={submitting}
                  data-testid="payment-confirm-sent"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  I&apos;ve Sent the Payment
                </button>
              </>
            )}

            {(step === 'done' || step === 'error') && (
              <button
                type="button"
                className="pm-slip__btn pm-slip__btn--method"
                onClick={onClose}
                data-testid="payment-close-final"
              >
                Close
              </button>
            )}
          </div>

          {step === 'select' && showVenmo && !showZelle && (
            <p className="pm-slip__hint">Opens Venmo to complete payment.</p>
          )}
          {step === 'select' && showZelle && !showVenmo && (
            <p className="pm-slip__hint">Shows Zelle send instructions — does not open your bank app.</p>
          )}
          {step === 'select' && dualMethods && (
            <p className="pm-slip__hint">
              Venmo opens the Venmo app or site. Zelle shows send instructions only.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
