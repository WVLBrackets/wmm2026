/**
 * Site admin identity — single source: `ADMIN_EMAIL` env (comma-separated list).
 * Used by ops admin, vintage CMS editing, and admin notifications.
 */

/**
 * Parse `ADMIN_EMAIL` into a lowercased list (empty when unset).
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * First configured admin email (notification recipient), or null.
 */
export function getPrimaryAdminEmail(): string | null {
  return getAdminEmails()[0] ?? null;
}

/**
 * True when `email` is listed in `ADMIN_EMAIL`.
 *
 * @param email - Address to test (case-insensitive)
 */
export function isAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && getAdminEmails().includes(normalized);
}
