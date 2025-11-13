'use client';

import { useUsageLogger } from '@/hooks/useUsageLogger';

/**
 * Client component to log page visits
 * Use this in server components to add logging
 * Usage: <PageLogger location="Home" />
 */
export function PageLogger({ location }: { location: string }) {
  useUsageLogger(location);
  return null;
}

