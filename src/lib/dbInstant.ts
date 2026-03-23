/**
 * Parse a Postgres `timestamptz` (or legacy timestamp) value from the driver into a JavaScript Date.
 * Values represent an instant in time (UTC); format for end users with `toLocaleString`, etc.
 *
 * @param value - `Date`, ISO string, or driver-specific value from `pg` / `@vercel/postgres`
 * @returns Valid Date, or invalid Date if value is null/empty/unparseable
 */
export function parseDbInstant(value: unknown): Date {
  if (value == null || value === '') {
    return new Date(NaN);
  }
  if (value instanceof Date) {
    return value;
  }
  const d = new Date(value as string);
  return d;
}
