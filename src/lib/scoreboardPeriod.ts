/** Live period choices; OT ladder supports uncapped N OT via normalize/format. */
export const LIVE_PERIOD_OPTIONS = [
  { value: '1st', label: '1st Half' },
  { value: '2nd', label: '2nd Half' },
  { value: 'OT', label: 'OT' },
  { value: '2OT', label: '2OT' },
  { value: '3OT', label: '3OT' },
  { value: '4OT', label: '4OT' },
  { value: '5OT', label: '5OT' },
  { value: '6OT', label: '6OT' },
  { value: '7OT', label: '7OT' },
  { value: '8OT', label: '8OT' },
  { value: '9OT', label: '9OT' },
  { value: '10OT', label: '10OT' },
] as const;

/**
 * Human period label for live/final status (1ST HALF, 2ND HALF, OT, 2OT, …).
 */
export function formatPeriodDisplay(raw: string | null | undefined): string {
  if (!raw) return '';
  const v = raw.trim();
  if (!v) return '';
  const lower = v.toLowerCase();
  if (lower === '1st' || lower.includes('1st') || lower === 'first half') {
    return '1ST HALF';
  }
  if (lower === '2nd' || lower.includes('2nd') || lower === 'second half') {
    return '2ND HALF';
  }
  const otMatch = lower.match(/^(\d+)\s*ot$/) || lower.match(/^(\d+)ot$/);
  if (otMatch) {
    const n = Number(otMatch[1]);
    return n <= 1 ? 'OT' : `${n}OT`;
  }
  if (lower === 'ot' || lower.includes('overtime')) return 'OT';
  if (lower.includes('ot')) {
    const n = lower.match(/(\d+)/)?.[1];
    if (n && Number(n) > 1) return `${n}OT`;
    return 'OT';
  }
  return v.toUpperCase();
}

/**
 * Normalize free-text period into select values (supports N OT uncapped).
 * Empty input stays empty so Final → Regulation can bind to "".
 */
export function normalizePeriod(raw: string | null): string {
  if (!raw || !raw.trim()) return '';
  const v = raw.trim().toLowerCase();
  if (v.includes('2nd') || v === 'second half') return '2nd';
  if (v.includes('1st') || v === 'first half') return '1st';
  if (v.startsWith('2') && !v.includes('ot') && !/^\d+ot$/.test(v)) return '2nd';
  const otNum = v.match(/^(\d+)\s*ot$/) || v.match(/^(\d+)ot$/);
  if (otNum) {
    const n = Number(otNum[1]);
    return n <= 1 ? 'OT' : `${n}OT`;
  }
  if (v === 'ot' || v.includes('overtime')) return 'OT';
  return raw.trim();
}

/**
 * Period options including any current custom N OT beyond the preset list.
 */
export function periodOptionsFor(
  current: string | null,
): Array<{ value: string; label: string }> {
  const base: Array<{ value: string; label: string }> = LIVE_PERIOD_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  const normalized = normalizePeriod(current);
  if (
    normalized &&
    normalized !== '1st' &&
    !base.some((o) => o.value === normalized)
  ) {
    base.push({ value: normalized, label: normalized });
  }
  // When final with empty period, select uses "".
  return base;
}
