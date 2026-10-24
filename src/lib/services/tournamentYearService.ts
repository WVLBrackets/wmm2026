import { getPublishedVintageContent } from '@/lib/vintage/store';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

// Re-export helpers so server call sites can keep a single import path.
export {
  buildYearScopedPath,
  isHistoricalYear,
  mergeAvailableYears,
  parseViewingYear,
} from '@/lib/services/tournamentYearHelpers';

/**
 * Parse a four-digit year string into an integer, or null if invalid.
 *
 * @param raw - Candidate year (e.g. homepage CMS `tournament.year`)
 */
function parseFourDigitYear(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const parsed = parseInt(String(raw).trim(), 10);
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return null;
  return parsed;
}

/**
 * Resolve the active Tourney Year from published homepage CMS Key Data.
 * Server-only (pulls Neon via vintage store). Client code must use
 * `tournamentYearHelpers` or values passed from a Server Component / API.
 *
 * @returns Active tournament year as an integer (e.g. 2027)
 */
export async function getActiveTournamentYear(): Promise<number> {
  try {
    const home = await getPublishedVintageContent();
    const fromCms = parseFourDigitYear(home.tournament?.year);
    if (fromCms != null) {
      return fromCms;
    }
  } catch (error) {
    console.warn('[tournamentYearService] Failed to load homepage CMS year; using fallback.', error);
  }

  const fallback = parseFourDigitYear(FALLBACK_CONFIG.tournamentYear);
  if (fallback != null) {
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
