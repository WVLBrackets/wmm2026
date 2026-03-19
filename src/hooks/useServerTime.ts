'use client';

import { useEffect, useMemo, useState } from 'react';

const DEFAULT_SYNC_INTERVAL_MS = 60_000;

/**
 * Synchronize client clock with server clock by tracking an offset.
 * Returns a function that always resolves the current server-aligned time.
 */
export function useServerTime(syncIntervalMs: number = DEFAULT_SYNC_INTERVAL_MS) {
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    let isMounted = true;

    /**
     * Fetch current server time and store offset from local clock.
     */
    const syncWithServer = async () => {
      try {
        const response = await fetch('/api/server-time', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result?.success || typeof result?.data?.nowMs !== 'number') {
          return;
        }

        if (isMounted) {
          setServerOffsetMs(result.data.nowMs - Date.now());
        }
      } catch {
        // Keep last known offset; server-side protection still enforces critical paths.
      }
    };

    syncWithServer();
    const intervalId = window.setInterval(syncWithServer, syncIntervalMs);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [syncIntervalMs]);

  const getServerNowMs = useMemo(() => {
    return () => Date.now() + serverOffsetMs;
  }, [serverOffsetMs]);

  return { getServerNowMs };
}
