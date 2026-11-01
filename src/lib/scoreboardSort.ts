/**
 * Client-safe scoreboard section sorts (no DB / server imports).
 */

/**
 * Tipoff sort key (ms); missing tipoffs sort last within their section.
 */
function tipoffSortMs(g: { tipoffAt?: Date | string | null }): number {
  if (!g.tipoffAt) return Number.MAX_SAFE_INTEGER;
  const t =
    g.tipoffAt instanceof Date
      ? g.tipoffAt.getTime()
      : new Date(g.tipoffAt).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/**
 * Fallback completion sort key (ms) from updatedAt.
 */
function updatedSortMs(g: { updatedAt: Date | string }): number {
  const t =
    g.updatedAt instanceof Date
      ? g.updatedAt.getTime()
      : new Date(g.updatedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Live section: tipoff ascending so games closest to ending (earlier tip) sit on top.
 */
export function sortLiveGames<
  T extends { tipoffAt: Date | string | null; gameKey: string },
>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const t = tipoffSortMs(a) - tipoffSortMs(b);
    if (t !== 0) return t;
    return a.gameKey.localeCompare(b.gameKey);
  });
}

/**
 * Upcoming section: tipoff ascending so the next tip is on top.
 */
export function sortUpcomingGames<
  T extends { tipoffAt: Date | string | null; gameKey: string },
>(games: T[]): T[] {
  return sortLiveGames(games);
}

/**
 * Final section: most recently completed first.
 * Uses tipoff descending (later slate ends later — Elite 8 before Sweet 16),
 * then updatedAt, then gameKey. Missing tipoffs sink below tipped finals.
 */
export function sortFinalGames<
  T extends {
    tipoffAt?: Date | string | null;
    updatedAt: Date | string;
    gameKey: string;
  },
>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const tipA = tipoffSortMs(a);
    const tipB = tipoffSortMs(b);
    const aMissing = tipA === Number.MAX_SAFE_INTEGER;
    const bMissing = tipB === Number.MAX_SAFE_INTEGER;
    if (!aMissing && !bMissing && tipA !== tipB) {
      return tipB - tipA;
    }
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    const u = updatedSortMs(b) - updatedSortMs(a);
    if (u !== 0) return u;
    return a.gameKey.localeCompare(b.gameKey);
  });
}

/**
 * Stable chronological order: tipoff ascending, then gameKey.
 */
export function sortGamesChronologically<
  T extends { tipoffAt: Date | string | null; gameKey: string },
>(games: T[]): T[] {
  return sortLiveGames(games);
}

/**
 * Split page games into Live / Upcoming / Final with section sorts.
 */
export function partitionScoreboardSections<
  T extends {
    status: string;
    tipoffAt: Date | string | null;
    updatedAt: Date | string;
    gameKey: string;
  },
>(
  pageGames: T[],
): {
  live: T[];
  upcoming: T[];
  completed: T[];
} {
  return {
    live: sortLiveGames(pageGames.filter((g) => g.status === 'live')),
    upcoming: sortUpcomingGames(
      pageGames.filter((g) => g.status === 'scheduled'),
    ),
    completed: sortFinalGames(pageGames.filter((g) => g.status === 'final')),
  };
}
