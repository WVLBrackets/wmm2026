import { config } from 'dotenv';
config({ path: '.env.local' });
config();

const { rebuildScoreboardSnapshot } = await import(
  '../src/lib/services/publicScoreboardService.ts'
);
const { tipoffCalendarDayKeyEt } = await import(
  '../src/lib/scoreboardR64DayBuckets.ts'
);

/**
 * Collect tipoff ISO strings from a page slice.
 * @param {import('../src/lib/types/publicScoreboard').ScoreboardPageSlice | undefined} slice
 */
function tipoffs(slice) {
  if (!slice) return [];
  return [...slice.live, ...slice.upcoming, ...slice.completed]
    .map((g) => g.tipoffAt)
    .filter(Boolean);
}

/**
 * Unique Eastern calendar days for tipoffs.
 * @param {string[]} isos
 */
function days(isos) {
  return [...new Set(isos.map((iso) => tipoffCalendarDayKeyEt(iso)).filter(Boolean))].sort();
}

const years = [2026, 2025, 2027];
for (const y of years) {
  try {
    const snap = await rebuildScoreboardSnapshot(y);
    const d1 = tipoffs(snap.bySlug['round-1-day-1']);
    const d2 = tipoffs(snap.bySlug['round-1-day-2']);
    console.log(
      `${y}: Day1 n=${d1.length} days=${JSON.stringify(days(d1))}; Day2 n=${d2.length} days=${JSON.stringify(days(d2))}`,
    );
  } catch (error) {
    console.log(`${y}: ERR`, error instanceof Error ? error.message : error);
  }
}
