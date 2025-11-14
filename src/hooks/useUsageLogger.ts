'use client';

import { useEffect } from 'react';
import { usageLogger } from '@/lib/usageLogger';

/**
 * Hook to log page visits
 * Usage: useUsageLogger('Home') in a page component
 */
export function useUsageLogger(location: string) {
  useEffect(() => {
    // Log page visit
    usageLogger.log('Page Visit', location);
  }, [location]);
}

