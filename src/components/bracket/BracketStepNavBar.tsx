'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { CheckCircle } from 'lucide-react';
import { useBracketEditorCopy } from '@/components/bracket/BracketEditorCopyContext';
import { formatEditorCopy } from '@/lib/vintage/bracketEditorContent';

const MQ_MAX_SM = '(max-width: 639px)';

/**
 * Subscribe to the small-screen media query.
 *
 * @param callback - Store change notifier
 */
function subscribeMaxSm(callback: () => void) {
  const mq = window.matchMedia(MQ_MAX_SM);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

/** Current small-screen media query match. */
function getMaxSmSnapshot() {
  return window.matchMedia(MQ_MAX_SM).matches;
}

/**
 * Compact nav initials: first letter for regions, word initials for the final step
 * (e.g. "Final Four" -> "FF").
 *
 * @param label - Full step label
 * @param isFinalStep - True for the Final Four step
 */
function stepLabelInitials(label: string, isFinalStep: boolean): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const initials = (isFinalStep ? words : words.slice(0, 1)).map((w) => [...w][0] ?? '');
  return initials.join('').toUpperCase();
}

/** True below the `sm` breakpoint. */
function useBracketStepNavCompact(): boolean {
  return useSyncExternalStore(subscribeMaxSm, getMaxSmSnapshot, () => false);
}

export interface BracketStepNavBarProps {
  totalSteps: number;
  currentStep: number;
  /** One label per step; last entry is the CMS Final Four title. */
  stepLabels: string[];
  /** Fixed column width in `ch` (use {@link computeUniformStepNavWidthCh} from `@/lib/bracketStepNavMetrics`). */
  columnWidthCh: number;
  isStepComplete: (step: number) => boolean;
  onStepClick: (stepIndex: number) => void;
  /** Native tooltip when Final Four is disabled (regions incomplete). */
  finalFourDisabledMessage: string;
}

/**
 * Text buttons for jumping between regions and Final Four in the bracket editor.
 * Navy selected / outlined available / gray unavailable; complete steps add a checkmark.
 */
export default function BracketStepNavBar({
  totalSteps,
  currentStep,
  stepLabels,
  columnWidthCh,
  isStepComplete,
  onStepClick,
  finalFourDisabledMessage,
}: BracketStepNavBarProps) {
  const compactNav = useBracketStepNavCompact();
  const copy = useBracketEditorCopy();

  const allRegionsComplete = Array.from({ length: Math.max(0, totalSteps - 1) }, (_, j) =>
    isStepComplete(j),
  ).every(Boolean);

  const resolvedLabels = useMemo(
    () =>
      Array.from({ length: totalSteps }, (_, i) => {
        const raw = stepLabels[i]?.trim();
        if (raw) return raw;
        return i === totalSteps - 1
          ? copy.finalFourTitle
          : formatEditorCopy(copy.stepRegionFallback, { n: i + 1 });
      }),
    [totalSteps, stepLabels, copy.finalFourTitle, copy.stepRegionFallback],
  );

  const gridTemplateColumns = compactNav
    ? `repeat(${totalSteps}, minmax(0, 1fr))`
    : `repeat(${totalSteps}, ${columnWidthCh}ch)`;

  return (
    <div
      className={`be-step-nav mx-auto grid max-w-full shrink-0 gap-1.5 px-1 pb-0.5 ${
        compactNav ? 'w-full overflow-x-visible' : 'w-max overflow-x-auto'
      }`}
      style={{ gridTemplateColumns }}
      data-testid="bracket-step-nav-bar"
      role="navigation"
      aria-label={copy.stepNavAriaLabel || undefined}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const isFinalStep = i === totalSteps - 1;
        const disabled = isFinalStep && !allRegionsComplete;
        const complete = isStepComplete(i);
        const isCurrent = i === currentStep;
        const label = resolvedLabels[i];

        let btnClass =
          'be-step-nav__btn flex h-full min-h-[2rem] w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-1 text-center text-xs font-semibold leading-tight shadow-sm transition-colors';
        if (disabled) {
          btnClass += ' be-step-nav__btn--disabled cursor-not-allowed';
        } else if (isCurrent) {
          btnClass += ' be-step-nav__btn--current cursor-pointer font-bold';
        } else if (complete) {
          btnClass += ' be-step-nav__btn--complete be-step-nav__btn--available cursor-pointer';
        } else {
          btnClass += ' be-step-nav__btn--available cursor-pointer';
        }

        const stateLabel = complete ? copy.stepCompleteLabel : copy.stepIncompleteLabel;
        const ariaLabel = stateLabel ? `${label}, ${stateLabel}` : label;

        return (
          <div key={i} className="flex min-w-0 items-center justify-center">
            <button
              type="button"
              data-testid={`bracket-step-nav-${i}`}
              onClick={() => !disabled && onStepClick(i)}
              disabled={disabled}
              title={disabled ? finalFourDisabledMessage || undefined : undefined}
              aria-label={ariaLabel}
              aria-current={isCurrent ? 'step' : undefined}
              className={btnClass}
            >
              {complete && (
                <CheckCircle
                  className={`shrink-0 ${compactNav ? 'h-3 w-3' : 'h-3.5 w-3.5'}`}
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
              <span
                className="shrink-0 text-center"
                data-testid={compactNav ? `bracket-step-nav-${i}-initial` : `bracket-step-nav-${i}-label`}
              >
                {compactNav ? stepLabelInitials(label, isFinalStep) : label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
