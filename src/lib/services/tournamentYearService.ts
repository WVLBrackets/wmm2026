import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

/**
 * Resolve the active tournament year from Google Sheets (fresh), with logged fallback.
 *
 * @returns Active tournament year as an integer (e.g. 2027)
 */
export async function getActiveTournamentYear(): Promise<number> {
  try {
    const config = await getSiteConfigFromGoogleSheetsFresh();
    if (config?.tournamentYear) {
      const parsed = parseInt(String(config.tournamentYear), 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('[tournamentYearService] Failed to load site config; using fallback year.', error);
  }

  const fallback = parseInt(String(FALLBACK_CONFIG.tournamentYear), 10);
  if (!Number.isNaN(fallback)) {
    console.warn(
      `[tournamentYearService] Using FALLBACK_CONFIG.tournamentYear=${fallback}`
    );
    return fallback;
  }

  const calendarYear = new Date().getFullYear();
  console.warn(
    `[tournamentYearService] FALLBACK_CONFIG.tournamentYear invalid; using calendar year ${calendarYear}`
  );
  return calendarYear;
}

/**
 * True when a bracket year is not the active tournament year (historical / read-only).
 *
 * @param bracketYear - Year stamped on the bracket row
 * @param activeYear - Current active tournament year
 */
export function isHistoricalYear(bracketYear: number, activeYear: number): boolean {
  return bracketYear !== activeYear;
}

/**
 * Resolve a `?year=` query value against the active tournament year.
 * Invalid / out-of-range values fall back to the active year.
 *
 * @param yearParam - Raw query string (e.g. from `searchParams.get('year')`)
 * @param activeYear - Current active tournament year
 */
export function parseViewingYear(
  yearParam: string | null | undefined,
  activeYear: number
): number {
  if (yearParam == null || String(yearParam).trim() === '') {
    return activeYear;
  }
  const parsed = parseInt(String(yearParam).trim(), 10);
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) {
    return activeYear;
  }
  return parsed;
}

/**
 * Build a path for My Picks / Standings with an optional year query.
 * Omits `?year=` when viewing the active year (clean default URL).
 *
 * @param basePath - Route path (e.g. `/bracket`)
 * @param viewingYear - Year being viewed
 * @param activeYear - Current active tournament year
 */
export function buildYearScopedPath(
  basePath: string,
  viewingYear: number,
  activeYear: number
): string {
  if (viewingYear === activeYear) {
    return basePath;
  }
  return `${basePath}?year=${viewingYear}`;
}

/**
 * Merge distinct bracket years with the active year for a year-switcher list (newest first).
 *
 * @param bracketYears - Years present on the user's brackets
 * @param activeYear - Active tournament year (always included)
 */
export function mergeAvailableYears(bracketYears: number[], activeYear: number): number[] {
  const set = new Set<number>();
  for (const y of bracketYears) {
    if (typeof y === 'number' && !Number.isNaN(y)) {
      set.add(y);
    }
  }
  set.add(activeYear);
  return Array.from(set).sort((a, b) => b - a);
}
