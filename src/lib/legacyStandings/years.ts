/**
 * Client-safe legacy standings year helpers (no snapshot JSON).
 */

/** Years with a packaged final archive (newest first). */
export const LEGACY_STANDINGS_YEARS: readonly number[] = [
  2025, 2024, 2023, 2022, 2021, 2019, 2018, 2017,
];

/**
 * Years with a special newspaper edition instead of a standings table
 * (newest first). 2020 = pandemic cancellation.
 */
export const NEWSPAPER_STANDINGS_YEARS: readonly number[] = [2020];

/** Last year served from static archives (not live KEY recompute). */
export const LAST_LEGACY_STANDINGS_YEAR = 2025;

/**
 * Whether this standings year is a static legacy archive
 * (no My Entries filter / no bracket open).
 *
 * @param year - Standings year under view
 */
export function isLegacyStandingsYear(year: number): boolean {
  return LEGACY_STANDINGS_YEARS.includes(year);
}

/**
 * Whether this year shows a newspaper edition instead of a table.
 *
 * @param year - Standings year under view
 */
export function isNewspaperStandingsYear(year: number): boolean {
  return NEWSPAPER_STANDINGS_YEARS.includes(year);
}

/**
 * Years with a packaged final standings archive (newest first).
 */
export function listLegacyStandingsYears(): number[] {
  return [...LEGACY_STANDINGS_YEARS];
}

/**
 * Years with a newspaper standings edition (newest first).
 */
export function listNewspaperStandingsYears(): number[] {
  return [...NEWSPAPER_STANDINGS_YEARS];
}

/**
 * All non-live archive years shown in the standings year selector
 * (legacy tables + newspaper editions), newest first.
 */
export function listStandingsArchiveYears(): number[] {
  return [...LEGACY_STANDINGS_YEARS, ...NEWSPAPER_STANDINGS_YEARS].sort(
    (a, b) => b - a,
  );
}
