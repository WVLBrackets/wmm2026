'use client';

import { useSyncExternalStore } from 'react';

const MD_UP_QUERY = '(min-width: 768px)';

/**
 * Subscribes to the Tailwind `md` breakpoint media query.
 *
 * @param onChange - Callback invoked when the query result changes.
 * @returns Unsubscribe function.
 */
function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(MD_UP_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * `true` when the viewport is at least Tailwind `md` (768px).
 * SSR snapshot is `true` (desktop-first); the client re-syncs after hydration.
 * Lets a layout render only one of desktop/mobile markup so `data-testid`s stay unique.
 *
 * @returns Whether the viewport is `md` or wider.
 */
export function useIsMdUp(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MD_UP_QUERY).matches,
    () => true,
  );
}
