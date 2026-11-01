/**
 * Warren's March Madness — site configuration access.
 * Browser (and isomorphic callers): `/api/site-config` (CMS payload).
 * Server route handlers / services: import `@/lib/siteConfigServer` directly.
 * Missing required CMS fields surface as errors — no silent season fallbacks.
 */

import { SiteConfigData, SiteConfigError } from '@/lib/siteConfig';

let cachedConfig: SiteConfigData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Drop the in-memory module cache so the next {@link getSiteConfig} call refetches.
 */
export function invalidateSiteConfigModuleCache(): void {
  cachedConfig = null;
  lastFetchTime = 0;
}

/**
 * Get site configuration with a short module-level TTL via `/api/site-config`.
 * Throws {@link SiteConfigError} when config cannot load.
 *
 * Kept free of Neon/`pg` so Client Components (Footer, nav, auth) can import it.
 */
export const getSiteConfig = async (): Promise<SiteConfigData> => {
  const now = Date.now();

  if (cachedConfig && now - lastFetchTime < CACHE_DURATION) {
    return cachedConfig;
  }

  const response = await fetch('/api/site-config');
  const result = await response.json();
  if (!response.ok || !result.success || !result.data) {
    throw new SiteConfigError(
      typeof result.error === 'string'
        ? result.error
        : `Failed to load site configuration (${response.status})`,
    );
  }
  cachedConfig = result.data as SiteConfigData;
  lastFetchTime = now;
  return cachedConfig;
};
