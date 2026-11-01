/**
 * Format tipoff dates for a scoreboard group title
 * (e.g. "3/21/26" or "3/26/26 - 3/29/26").
 */

/**
 * Compact ET calendar date M/D/YY from an ISO tipoff.
 *
 * @param iso - Tipoff ISO string
 * @param timeZone - IANA zone (default America/New_York)
 */
export function formatScoreboardPlayedDate(
  iso: string | null | undefined,
  timeZone = 'America/New_York',
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  }).formatToParts(date);

  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  if (!month || !day || !year) return null;
  return `${month}/${day}/${year}`;
}

/**
 * Build a compact ET date range from game tipoffs.
 * One day → `3/21/26`. Multiple days → `3/26/26 - 3/29/26` (first–last).
 *
 * @param tipoffIsos - ISO tipoff strings (nullable entries ignored)
 */
export function formatScoreboardDateLabel(
  tipoffIsos: Array<string | null | undefined>,
): string | null {
  const byDay = new Map<string, { sortKey: string; label: string }>();

  for (const iso of tipoffIsos) {
    if (!iso) continue;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;

    const label = formatScoreboardPlayedDate(iso);
    if (!label) continue;

    const sortParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date); // YYYY-MM-DD

    byDay.set(sortParts, {
      sortKey: sortParts,
      label,
    });
  }

  if (byDay.size === 0) return null;
  const ordered = Array.from(byDay.values()).sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey),
  );
  if (ordered.length === 1) return ordered[0].label;
  return `${ordered[0].label} - ${ordered[ordered.length - 1].label}`;
}
