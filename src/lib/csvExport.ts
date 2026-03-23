/**
 * Utilities for CSV exports that open cleanly in Microsoft Excel (Windows/macOS).
 */

/**
 * Excel formula / Lotus 1-2-3 injection guard (U+200B).
 * Invisible in Excel when the file is read as UTF-8 (BOM + binary download — see encodeCsvUtf8WithBom).
 * TAB was used temporarily when BOM was stripped client-side; it showed as leading “spaces.”
 */
const EXCEL_TEXT_GUARD_CHAR = '\u200B';

/**
 * Encode CSV text as UTF-8 bytes with a real BOM (EF BB BF).
 * Use this for `NextResponse` bodies. Do not rely on a leading `\uFEFF` in a JS string alone:
 * the admin UI uses `fetch().arrayBuffer()` so the BOM survives; `fetch().text()` strips BOM per spec.
 *
 * @param csvText - Full CSV without BOM (plain string)
 */
export function encodeCsvUtf8WithBom(csvText: string): Uint8Array {
  const encoder = new TextEncoder();
  const payload = encoder.encode(csvText);
  const out = new Uint8Array(3 + payload.length);
  out[0] = 0xef;
  out[1] = 0xbb;
  out[2] = 0xbf;
  out.set(payload, 3);
  return out;
}

/**
 * Prefix so Excel does not treat the cell as a formula (=, +, -, @, control chars).
 * Uses U+200B (invisible when UTF-8 BOM is preserved). Stripped on re-import.
 *
 * @param value - Raw field text (after String conversion)
 * @returns The same text, or prefixed with U+200B when Excel would misinterpret the start
 */
export function prependExcelTextGuard(value: string): string {
  if (value.length === 0) return value;

  const first = value[0];

  if (first === '=' || first === '+' || first === '@') {
    return `${EXCEL_TEXT_GUARD_CHAR}${value}`;
  }

  if (first === '\t' || first === '\r') {
    return `${EXCEL_TEXT_GUARD_CHAR}${value}`;
  }

  if (first === '-') {
    const t = value.trim();
    if (/^-\d+(\.\d+)?$/.test(t) || /^-\d*\.\d+$/.test(t)) {
      return value;
    }
    return `${EXCEL_TEXT_GUARD_CHAR}${value}`;
  }

  return value;
}

/**
 * Escape one cell for CSV (RFC 4180) and apply Excel-safe guards for string values.
 *
 * @param value - Cell value (strings get formula guard; numbers are stringified without breaking -123 style literals)
 */
export function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';

  const str = typeof value === 'number' ? String(value) : prependExcelTextGuard(String(value));

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
