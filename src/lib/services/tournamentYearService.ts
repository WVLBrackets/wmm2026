import { getPublishedVintageContent } from '@/lib/vintage/store';
import { SiteConfigError } from '@/lib/siteConfig';

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
 * Throws when CMS is unavailable or the year is missing/invalid — no calendar/FALLBACK substitute.
 *
 * @returns Active tournament year as an integer (e.g. 2027)
 */
export async function getActiveTournamentYear(): Promise<number> {
  let home;
  try {
    home = await getPublishedVintageContent();
  } catch (error) {
    throw new SiteConfigError(
      `Cannot resolve Tourney Year: homepage CMS unavailable (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  const fromCms = parseFourDigitYear(home.tournament?.year);
  if (fromCms == null) {
    throw new SiteConfigError(
      'Published homepage Key Data is missing a valid Tourney Year (YYYY).',
    );
  }
  return fromCms;
}
