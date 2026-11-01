'use client';

import LoadingBasketball from './LoadingBasketball';
import './feedback.css';

/**
 * Modal-level waiting state shown after a confirmed action while the request runs.
 * Renders nothing when closed.
 */
export default function BusyOverlay({
  open,
  message,
  testId = 'busy-overlay',
}: {
  open: boolean;
  /** CMS-sourced message; blank shows the basketball alone. */
  message?: string;
  testId?: string;
}) {
  if (!open) return null;
  return (
    <div className="v-busy-overlay" role="presentation" data-testid={testId}>
      <div className="v-busy-overlay__card">
        <LoadingBasketball variant="plain" message={message} testId={`${testId}-loader`} />
      </div>
    </div>
  );
}
