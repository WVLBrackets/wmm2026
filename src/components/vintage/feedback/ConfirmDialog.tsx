'use client';

import { useEffect, useId, useRef } from 'react';
import CmsText from '@/components/cms/CmsText';
import LoadingBasketball from './LoadingBasketball';
import './feedback.css';

export type ConfirmDialogTone = 'danger' | 'warn' | 'neutral';

export interface ConfirmDialogProps {
  open: boolean;
  /** CMS title; blank hides the heading. */
  title: string;
  /** CMS body (supports `||` paragraph breaks); blank hides the body. */
  message: string;
  confirmLabel: string;
  /** Blank hides Cancel (single-button notice); Escape / backdrop still dismiss. */
  cancelLabel: string;
  tone?: ConfirmDialogTone;
  /** While true, buttons disable and the busy message (if any) replaces the body. */
  busy?: boolean;
  /** CMS message shown with the basketball while `busy`. */
  busyMessage?: string;
  /** Inline error (e.g. request failed) shown above the actions. */
  errorMessage?: string | null;
  testId: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional form content (e.g. a rename input) between body and actions. */
  children?: React.ReactNode;
  /** Disable Confirm without entering the busy state (e.g. empty required input). */
  confirmDisabled?: boolean;
}

/**
 * Shared vintage confirmation popup. Focuses Cancel on open; Escape and
 * backdrop click cancel unless busy.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  busyMessage,
  errorMessage,
  testId,
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(
      () => (cancelRef.current ?? confirmRef.current)?.focus(),
      0,
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const showBusy = busy && Boolean(busyMessage?.trim());

  return (
    <div
      className="v-confirm__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className={`v-confirm v-confirm--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title.trim() ? titleId : undefined}
        aria-describedby={message.trim() ? messageId : undefined}
        aria-busy={busy || undefined}
        data-testid={testId}
      >
        {title.trim() ? (
          <h2 id={titleId} className="v-confirm__title">
            {title}
          </h2>
        ) : null}
        {showBusy ? (
          <div className="v-confirm__status">
            <LoadingBasketball
              variant="plain"
              message={busyMessage}
              testId={`${testId}-busy`}
            />
          </div>
        ) : message.trim() ? (
          <div id={messageId} className="v-confirm__body">
            <CmsText mode="paragraphs" text={message} />
          </div>
        ) : null}
        {children && !showBusy ? <div className="v-confirm__form">{children}</div> : null}
        {errorMessage?.trim() && !busy ? (
          <p className="v-confirm__status v-confirm__status--error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="v-confirm__actions">
          <button
            ref={confirmRef}
            type="button"
            className="v-confirm__btn v-confirm__btn--yes"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            data-testid={`${testId}-yes`}
          >
            {confirmLabel}
          </button>
          {cancelLabel.trim() ? (
            <button
              ref={cancelRef}
              type="button"
              className="v-confirm__btn v-confirm__btn--no"
              onClick={onCancel}
              disabled={busy}
              data-testid={`${testId}-no`}
            >
              {cancelLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
