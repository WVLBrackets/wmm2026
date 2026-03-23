export const DEV_AUTH_BYPASS_PASSWORD = 'DEV_AUTH_BYPASS';

/**
 * Ensure dev auth bypass cannot be enabled outside development.
 */
function assertDevBypassSafety() {
  if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'development') {
    throw new Error('DEV_AUTH_BYPASS may only be enabled in development.');
  }
}

/**
 * Returns true only for explicitly enabled development bypass mode.
 */
export function isDevAuthBypassServerEnabled(): boolean {
  assertDevBypassSafety();
  return process.env.NODE_ENV === 'development' && process.env.DEV_AUTH_BYPASS === 'true';
}

/**
 * Server-side configured bypass email.
 */
export function getDevAuthBypassEmailServer(): string {
  const email = process.env.DEV_AUTH_EMAIL || process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL || 'wvanderlaan@gmail.com';
  return email.trim().toLowerCase();
}

/**
 * Client-side bypass mode flag.
 */
export function isDevAuthBypassClientEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
}

/**
 * Client-side bypass email used for automatic sign-in.
 */
export function getDevAuthBypassEmailClient(): string {
  const email = process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL || 'wvanderlaan@gmail.com';
  return email.trim().toLowerCase();
}
