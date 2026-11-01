import { isLegacyStandingsYear } from '@/lib/legacyStandings/years';
import { getPublishedVintageStandingsContent } from '@/lib/vintage/standingsStore';
import { getPublishedVintageContent } from '@/lib/vintage/store';

/**
 * True when Standings CMS Tournament Live is explicitly on.
 * Missing / blank / false-ish → not live (roster mode for active year).
 *
 * @param value - Raw CMS `tournamentLive` string or boolean
 */
export function isStandingsTournamentLive(
  value: boolean | string | undefined | null,
): boolean {
  if (typeof value === 'boolean') return value;
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1' || v === 'on';
}

/**
 * Whether year Y should use the privacy-safe roster (names + count only)
 * instead of full live standings.
 *
 * Gated by Standings CMS `tournamentLive` (not tipoff). Tipoff continues to
 * lock Changing/submit via Action Lock separately.
 *
 * @param year - Requested standings year
 * @param activeTourneyYear - Homepage CMS tourney year
 * @param tournamentLive - Standings CMS Tournament Live flag
 */
export function shouldUseStandingsRosterMode(
  year: number,
  activeTourneyYear: number,
  tournamentLive: boolean | string | undefined | null,
): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(activeTourneyYear)) {
    return false;
  }
  if (isLegacyStandingsYear(year)) {
    return false;
  }
  if (year !== activeTourneyYear) {
    return false;
  }
  return !isStandingsTournamentLive(tournamentLive);
}

/**
 * True when public pool bracket reads must be blocked for this year
 * (active homepage year while Standings Tournament Live is off).
 *
 * @param bracketYear - Year stamped on the bracket
 */
export async function isPoolBracketReadBlockedBeforeStandingsLive(
  bracketYear: number,
): Promise<boolean> {
  const [home, standingsCopy] = await Promise.all([
    getPublishedVintageContent(),
    getPublishedVintageStandingsContent(),
  ]);
  const activeYear = parseInt(String(home.tournament.year).trim(), 10);
  if (Number.isNaN(activeYear)) {
    return false;
  }
  return shouldUseStandingsRosterMode(
    bracketYear,
    activeYear,
    standingsCopy.tournamentLive,
  );
}

/**
 * @deprecated Use {@link isPoolBracketReadBlockedBeforeStandingsLive}.
 */
export async function isPoolBracketReadBlockedBeforeTipoff(
  bracketYear: number,
): Promise<boolean> {
  return isPoolBracketReadBlockedBeforeStandingsLive(bracketYear);
}
