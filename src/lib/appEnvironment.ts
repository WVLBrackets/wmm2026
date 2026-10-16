export type AppEnvironment = 'local' | 'preview' | 'production';

/**
 * Resolve the current app environment with explicit override support.
 */
export function getAppEnvironment(): AppEnvironment {
  const explicit = process.env.APP_ENV?.trim().toLowerCase();

  if (explicit) {
    if (explicit === 'local') return 'local';
    if (explicit === 'preview' || explicit === 'staging' || explicit === 'stage') return 'preview';
    if (explicit === 'production' || explicit === 'prod') return 'production';
    throw new Error(`Invalid APP_ENV value: "${process.env.APP_ENV}". Use local, preview, or production.`);
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';

  if (process.env.NODE_ENV === 'development') return 'local';
  return 'production';
}

/**
 * Convenience helper for production checks.
 */
export function isProductionEnvironment(): boolean {
  return getAppEnvironment() === 'production';
}

/**
 * Browser-tab title prefix so Local / Staging are distinguishable without clicking.
 * Production returns an empty string (no change to the public title).
 *
 * @param appEnv - Resolved app environment
 * @returns `[L] ` for local, `[S] ` for staging/preview, otherwise `''`
 */
export function getEnvironmentTitlePrefix(appEnv: AppEnvironment = getAppEnvironment()): string {
  if (appEnv === 'local') return '[L] ';
  if (appEnv === 'preview') return '[S] ';
  return '';
}
