'use client';

import { useMemo } from 'react';
import { CheckCircle } from 'lucide-react';
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
  const allRegionsComplete = Array.from({ length: Math.max(0, totalSteps - 1) }, (_, j) =>
    isStepComplete(j),
  ).every(Boolean);

  const resolvedLabels = useMemo(
    () =>
      Array.from({ length: totalSteps }, (_, i) => resolveStepLabel(i, totalSteps, stepLabels)),
    [totalSteps, stepLabels],
  );

  return (
    <div
      className="grid w-max max-w-full shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5"
      style={{
        gridTemplateColumns: `repeat(${totalSteps}, ${columnWidthCh}ch)`,
      }}
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

        const activeRing =
          ' ring-4 ring-amber-400 ring-offset-2 shadow-md border-2 border-amber-300 font-bold';
        let btnClass =
          'flex h-full min-h-[2rem] w-full items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-center text-xs font-semibold leading-tight shadow-sm transition-colors';
        if (disabled) {
          btnClass += ' bg-gray-200 text-gray-500 cursor-not-allowed';
        } else if (complete && isCurrent) {
          btnClass +=
            ' bg-green-600 text-white hover:bg-green-700 cursor-pointer ring-1 ring-green-800/30' +
            activeRing;
        } else if (complete) {
          btnClass +=
            ' bg-green-600 text-white hover:bg-green-700 cursor-pointer ring-1 ring-green-800/30';
        } else if (isCurrent) {
          btnClass +=
            ' bg-blue-600 text-white cursor-pointer hover:bg-blue-700' + activeRing;
        } else {
          btnClass += ' bg-blue-600 text-white hover:bg-blue-700 cursor-pointer';
        }

        const ariaLabel = complete ? `${label}, complete` : `${label}, not complete`;

        return (
          <button
            key={i}
            type="button"
            data-testid={`bracket-step-nav-${i}`}
            onClick={() => !disabled && onStepClick(i)}
            disabled={disabled}
            title={disabled ? finalFourDisabledMessage : undefined}
            aria-label={ariaLabel}
            aria-current={isCurrent ? 'step' : undefined}
            className={btnClass}
          >
            {complete && (
              <CheckCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
            )}
            <span className="max-w-full break-words text-center">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
