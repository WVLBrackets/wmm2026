'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { CheckCircle } from 'lucide-react';

const MQ_MAX_SM = '(max-width: 639px)';

function subscribeMaxSm(callback: () => void) {
  const mq = window.matchMedia(MQ_MAX_SM);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getMaxSmSnapshot() {
  return window.matchMedia(MQ_MAX_SM).matches;
}

/** First grapheme (handles basic Unicode); uppercased for nav initials. */
function stepLabelInitial(label: string): string {
  const t = label.trim();
  if (!t) return '?';
  const first = [...t][0];
  return first ? first.toUpperCase() : '?';
}

function useBracketStepNavCompact(): boolean {
  return useSyncExternalStore(subscribeMaxSm, getMaxSmSnapshot, () => false);
}
export interface BracketStepNavBarProps {
  totalSteps: number;
  currentStep: number;
  /** One label per step; last entry is typically "Final Four". */
  stepLabels: string[];
  /** Fixed column width in `ch` (use {@link computeUniformStepNavWidthCh} from `@/lib/bracketStepNavMetrics`). */
  columnWidthCh: number;
  isStepComplete: (step: number) => boolean;
  onStepClick: (stepIndex: number) => void;
  /** Native tooltip when Final Four is disabled (regions incomplete). */
  finalFourDisabledMessage: string;
}

/**
 * Resolves the visible label for a step (region name, "Final Four", or fallback).
 */
function resolveStepLabel(index: number, totalSteps: number, stepLabels: string[]): string {
  return stepLabels[index]?.trim() || (index === totalSteps - 1 ? 'Final Four' : `Region ${index + 1}`);
}

/**
 * Text buttons for jumping between regions and Final Four in the bracket editor.
 * Complete steps use green plus a checkmark icon for color-blind clarity.
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

  const allRegionsComplete = Array.from({ length: Math.max(0, totalSteps - 1) }, (_, j) =>
    isStepComplete(j),
  ).every(Boolean);

  const resolvedLabels = useMemo(
    () =>
      Array.from({ length: totalSteps }, (_, i) => resolveStepLabel(i, totalSteps, stepLabels)),
    [totalSteps, stepLabels],
  );

  const gridTemplateColumns = compactNav
    ? `repeat(${totalSteps}, minmax(0, 1fr))`
    : `repeat(${totalSteps}, ${columnWidthCh}ch)`;

  return (
    <div
      className={`mx-auto grid max-w-full shrink-0 gap-1.5 px-1 pb-0.5 ${
        compactNav ? 'w-full overflow-x-visible' : 'w-max overflow-x-auto'
      }`}
      style={{ gridTemplateColumns }}
      data-testid="bracket-step-nav-bar"
      role="navigation"
      aria-label="Bracket sections"
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const isFinalStep = i === totalSteps - 1;
        const disabled = isFinalStep && !allRegionsComplete;
        const complete = isStepComplete(i);
        const isCurrent = i === currentStep;
        const label = resolvedLabels[i];

        let btnClass =
          'flex h-full min-h-[2rem] w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-1 text-center text-xs font-semibold leading-tight shadow-sm transition-colors';
        if (disabled) {
          btnClass += ' bg-gray-200 text-gray-500 cursor-not-allowed';
        } else if (complete && isCurrent) {
          btnClass +=
            ' bg-green-600 text-white hover:bg-green-700 cursor-pointer ring-1 ring-green-800/30 font-bold';
        } else if (complete) {
          btnClass +=
            ' bg-green-600 text-white hover:bg-green-700 cursor-pointer ring-1 ring-green-800/30';
        } else if (isCurrent) {
          btnClass += ' bg-blue-600 text-white cursor-pointer hover:bg-blue-700 font-bold';
        } else {
          btnClass += ' bg-blue-600 text-white hover:bg-blue-700 cursor-pointer';
        }

        const ariaLabel = complete ? `${label}, complete` : `${label}, not complete`;

        return (
          <div key={i} className="flex min-w-0 items-center justify-center">
            <button
              type="button"
              data-testid={`bracket-step-nav-${i}`}
              onClick={() => !disabled && onStepClick(i)}
              disabled={disabled}
              title={disabled ? finalFourDisabledMessage : undefined}
              aria-label={ariaLabel}
              aria-current={isCurrent ? 'step' : undefined}
              className={btnClass}
            >
              {isCurrent && !disabled ? (
                <span className="shrink-0 text-base font-bold leading-none text-amber-500" aria-hidden>
                  (
                </span>
              ) : null}
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
                {compactNav ? (isFinalStep ? 'FF' : stepLabelInitial(label)) : label}
              </span>
              {isCurrent && !disabled ? (
                <span className="shrink-0 text-base font-bold leading-none text-amber-500" aria-hidden>
                  )
                </span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
