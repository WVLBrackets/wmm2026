/**
 * Production boot checks for required env vars.
 * Call from `/api/health` and optionally from instrumentation.
 */

const PROD_REQUIRED = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "ADMIN_EMAIL",
] as const;

/**
 * True for Vercel Production only (not Preview/staging).
 * Off Vercel, falls back to NODE_ENV === "production" (e.g. local `next start`).
 */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

/**
 * Throw if production is missing required configuration or has a dev bypass on.
 *
 * @throws Error when production config is unsafe
 */
export function assertProductionEnv(): void {
  if (!isProductionRuntime()) return;
  const missing = PROD_REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (process.env.DEV_AUTH_BYPASS === "true" || process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    throw new Error("DEV_AUTH_BYPASS must not be enabled in production.");
  }
}

/**
 * App origin for emails and auth callbacks. Requires `NEXTAUTH_URL` (no product-domain fallback).
 *
 * @throws Error when unset
 */
export function requireAppOrigin(): string {
  const url = process.env.NEXTAUTH_URL?.trim();
  if (!url) {
    throw new Error("NEXTAUTH_URL is required.");
  }
  return url.replace(/\/$/, "");
}
