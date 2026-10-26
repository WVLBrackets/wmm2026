'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Accessible hover/focus tooltip for My Picks icon actions.
 * Shown only on devices that support hover (or keyboard focus).
 * Escape dismisses; first touch does not steal activation.
 */
export default function PicksActionTip({
  label,
  children,
}: {
  /** Concise action name / disabled reason shown in the tip. */
  label: string;
  children: ReactNode;
}) {
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        const active = document.activeElement;
        if (active instanceof HTMLElement && wrapRef.current?.contains(active)) {
          active.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <span
      ref={wrapRef}
      className={`v-picks__tip${open ? ' is-open' : ''}`}
      data-testid="picks-action-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!wrapRef.current?.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
    >
      {children}
      <span
        id={tipId}
        role="tooltip"
        className="v-picks__tip-bubble"
        hidden={!open}
      >
        {label}
      </span>
    </span>
  );
}
