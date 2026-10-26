'use client';

import { useEffect, useId, useRef } from 'react';
import type { VintagePicksConfirmCopy } from '@/lib/vintage/picksContent';
import { formatPicksConfirmText } from '@/lib/vintage/picksContent';

export type PicksConfirmTone = 'danger' | 'warn';

/**
 * Shared My Picks confirmation popup (delete / permanent delete / return).
 * Focuses the cancel button on open; Escape cancels.
 */
export default function PicksConfirmModal({
  open,
  copy,
  entryName,
  tone = 'danger',
  busy = false,
  testId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  copy: VintagePicksConfirmCopy;
  entryName: string;
  tone?: PicksConfirmTone;
  busy?: boolean;
  testId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
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

  const title = formatPicksConfirmText(copy.title, entryName);
  const message = formatPicksConfirmText(copy.message, entryName);
  const parts = message.split('||');

  return (
    <div
      className="v-picks__confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className={`v-picks__confirm-dialog v-picks__confirm-dialog--${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        data-testid={testId}
      >
        <h2 id={titleId} className="v-picks__confirm-title">
          {title}
        </h2>
        <div id={messageId} className="v-picks__confirm-message">
          {parts.map((part, index) => (
            <p key={index}>{part}</p>
          ))}
        </div>
        <div className="v-picks__confirm-actions">
          <button
            type="button"
            className="v-picks__confirm-btn v-picks__confirm-btn--yes"
            onClick={onConfirm}
            disabled={busy}
            data-testid={`${testId}-yes`}
          >
            {copy.confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="v-picks__confirm-btn v-picks__confirm-btn--no"
            onClick={onCancel}
            disabled={busy}
            data-testid={`${testId}-no`}
          >
            {copy.cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
