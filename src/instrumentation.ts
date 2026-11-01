/**
 * Next.js boot hook: refuse production when required env is missing.
 */
export async function register(): Promise<void> {
  const { assertProductionEnv } = await import("@/lib/env");
  assertProductionEnv();
}
