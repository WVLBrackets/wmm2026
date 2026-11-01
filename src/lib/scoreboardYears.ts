/**
 * Scoreboard year policy — historical boards start at 2026.
 */

/** Earliest year exposed in the public / admin scoreboard year switcher. */
export const SCOREBOARD_MIN_YEAR = 2026;

/**
 * Drop pre-2026 years even when field JSON or DB rows exist.
 *
 * @param years - Candidate tournament years
 */
export function filterScoreboardYears(years: number[]): number[] {
  const set = new Set<number>();
  for (const y of years) {
    if (typeof y === 'number' && Number.isFinite(y) && y >= SCOREBOARD_MIN_YEAR) {
      set.add(y);
    }
  }
  return Array.from(set).sort((a, b) => b - a);
}
