/**
 * Shared server-side error log line (no secrets).
 *
 * @param location - Route or module name
 * @param error - Caught value
 */
export function logServerError(location: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${location}]`, message);
}
