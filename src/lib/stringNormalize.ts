/**
 * Normalize user-visible labels before persisting to the database.
 * Trims leading and trailing whitespace — especially trailing spaces from copy/paste,
 * which otherwise cause duplicate-name checks and display mismatches.
 *
 * Also removes a leading U+200B / U+FEFF from older CSV exports, and leading TAB from
 * Excel formula guards (`prependExcelTextGuard` in csvExport.ts) is removed via `.trim()`.
 */
export function normalizeStoredDisplayName(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/^[\u200B\uFEFF]+/g, '').trim();
}
