/**
 * Round of 64 Day 1 / Day 2 bucketing by Eastern tipoff calendar day.
 * Day 1 = earliest tipped day; Day 2 = the next tipped day (and any later R64 tips).
 */

export type R64GameForDayBucket = {
  gameKey: string;
  tipoffAt: string | Date | null | undefined;
};

export type R64DayBuckets = {
  day1Keys: string[];
  day2Keys: string[];
  /** R64 games with no usable tipoff (held aside until sync fills tips). */
  unscheduledKeys: string[];
};

/**
 * Eastern calendar day key `YYYY-MM-DD` for a tipoff instant.
 *
 * @param tipoffAt - ISO string or Date
 * @param timeZone - IANA zone (default America/New_York)
 */
export function tipoffCalendarDayKeyEt(
  tipoffAt: string | Date | null | undefined,
  timeZone = 'America/New_York',
): string | null {
  if (!tipoffAt) return null;
  const date = tipoffAt instanceof Date ? tipoffAt : new Date(tipoffAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Sort key for tipoff ordering (ms). Missing / invalid tips sort last.
 *
 * @param tipoffAt - ISO string or Date
 */
function tipoffSortMs(tipoffAt: string | Date | null | undefined): number {
  if (!tipoffAt) return Number.POSITIVE_INFINITY;
  const date = tipoffAt instanceof Date ? tipoffAt : new Date(tipoffAt);
  const ms = date.getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/**
 * Bucket Round of 64 games onto Day 1 / Day 2 by Eastern tipoff date.
 * Within each day, order by tipoff time then gameKey.
 *
 * When tipoffs are missing, keys land in `unscheduledKeys` (caller decides placement).
 * When only one tipped calendar day exists, all tipped games go to Day 1.
 * When three+ tipped days exist, earliest → Day 1 and the rest → Day 2.
 *
 * @param games - R64 rows with keys + tipoffs
 */
export function bucketR64ByTipoffDay(games: R64GameForDayBucket[]): R64DayBuckets {
  const unscheduledKeys: string[] = [];
  const byDay = new Map<
    string,
    Array<{ gameKey: string; tipMs: number }>
  >();

  for (const game of games) {
    const key = String(game.gameKey ?? '').trim();
    if (!key) continue;
    const day = tipoffCalendarDayKeyEt(game.tipoffAt);
    if (!day) {
      unscheduledKeys.push(key);
      continue;
    }
    const list = byDay.get(day) ?? [];
    list.push({ gameKey: key, tipMs: tipoffSortMs(game.tipoffAt) });
    byDay.set(day, list);
  }

  const orderedDays = Array.from(byDay.keys()).sort((a, b) => a.localeCompare(b));
  const sortDayGames = (rows: Array<{ gameKey: string; tipMs: number }>) =>
    [...rows]
      .sort(
        (a, b) =>
          a.tipMs - b.tipMs || a.gameKey.localeCompare(b.gameKey),
      )
      .map((r) => r.gameKey);

  if (orderedDays.length === 0) {
    return {
      day1Keys: [],
      day2Keys: [],
      unscheduledKeys: unscheduledKeys.sort((a, b) => a.localeCompare(b)),
    };
  }

  const day1Keys = sortDayGames(byDay.get(orderedDays[0]) ?? []);
  const day2Keys: string[] = [];
  for (const day of orderedDays.slice(1)) {
    day2Keys.push(...sortDayGames(byDay.get(day) ?? []));
  }

  unscheduledKeys.sort((a, b) => a.localeCompare(b));
  return { day1Keys, day2Keys, unscheduledKeys };
}
