'use client';

import { useEffect } from 'react';
import SiteErrorPanel from '@/components/vintage/feedback/SiteErrorPanel';

/**
 * Route-level error boundary. Reached when a page cannot render — most often
 * because the published CMS (the source of all visitor copy) failed to load.
 * The server already emailed the admin (`notifyAdminOfError`), so this copy is
 * the one intentional in-code string: there is no CMS to read it from.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return (
    <main className="v-site-error-page" data-testid="route-error">
      <SiteErrorPanel
        title="Temporarily unavailable"
        message="The site couldn’t load right now. The administrator has been notified.||Please try again in a few minutes."
      >
        <button
          type="button"
          className="v-confirm__btn v-confirm__btn--no"
          style={{ marginTop: 18 }}
          onClick={reset}
          data-testid="route-error-retry"
        >
          Try again
        </button>
      </SiteErrorPanel>
    </main>
  );
}
