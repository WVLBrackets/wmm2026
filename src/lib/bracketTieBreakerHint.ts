/**
 * Allows empty string or digits only (non-negative integers as string). Use for controlled inputs.
 */
export function filterTieBreakerIntegerString(raw: string): string | null {
  if (raw === '') return '';
  return /^\d+$/.test(raw) ? raw : null;
}
