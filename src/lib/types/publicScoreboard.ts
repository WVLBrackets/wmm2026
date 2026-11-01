/** Public Scoreboard page grouping (admin-configurable). */
export type ScoreboardPage = {
  environment: string;
  year: number;
  slug: string;
  label: string;
  sortOrder: number;
  /** Desktop games per row (1–4). */
  desktopCols: number;
  /** Mobile games per row (1–2). */
  mobileCols: number;
  updatedAt: Date;
};

/** Display / feed fields beyond core Scoreboard of Record row. */
export type ScoreboardGameDisplay = {
  tipoffAt: Date | null;
  periodLabel: string | null;
  clock: string | null;
  statusNote: string | null;
};

/** Public card payload (JSON-safe). */
export type PublicScoreboardGame = {
  gameKey: string;
  kind: 'bracket' | 'first_four';
  roundLabel: string;
  region: string | null;
  seed1: number | null;
  seed2: number | null;
  team1Id: string | null;
  team2Id: string | null;
  team1Name: string | null;
  team2Name: string | null;
  team1LogoUrl: string | null;
  team2LogoUrl: string | null;
  status: 'scheduled' | 'live' | 'final';
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  tipoffAt: string | null;
  periodLabel: string | null;
  clock: string | null;
  statusNote: string | null;
  updatedAt: string;
};

export type PublicScoreboardPageSummary = {
  slug: string;
  label: string;
  sortOrder: number;
  desktopCols: number;
  mobileCols: number;
  gameCount: number;
};

/** Full public board for one group page. */
export type PublicScoreboardPayload = {
  year: number;
  pages: PublicScoreboardPageSummary[];
  page: PublicScoreboardPageSummary;
  live: PublicScoreboardGame[];
  upcoming: PublicScoreboardGame[];
  completed: PublicScoreboardGame[];
  lastUpdatedAt: string | null;
  subtitle: string;
  /**
   * Compact tipoff date range for this group, e.g. "3/21/26 & 3/22/26".
   * Null when no tipoffs are set yet.
   */
  dateLabel: string | null;
};

/** Games for one group inside the year snapshot. */
export type ScoreboardPageSlice = {
  /** In-progress games; tipoff ascending (earliest tip / closest to ending first). */
  live: PublicScoreboardGame[];
  /** Not started; tipoff ascending (next tip first). */
  upcoming: PublicScoreboardGame[];
  /** Finals; completion time descending (newest final on top). */
  completed: PublicScoreboardGame[];
};

/**
 * Persisted year blob (one Neon row). Public reads slice by slug in memory.
 * Rebuilt only on admin save / explicit rebuild — never on visitor refresh.
 */
export type ScoreboardYearSnapshot = {
  year: number;
  subtitle: string;
  pages: PublicScoreboardPageSummary[];
  bySlug: Record<string, ScoreboardPageSlice>;
  lastUpdatedAt: string | null;
  computedAt: string;
};

export const DEFAULT_SCOREBOARD_PAGES: Array<{
  slug: string;
  label: string;
  sortOrder: number;
  desktopCols: number;
  mobileCols: number;
}> = [
  { slug: 'play-in', label: 'Play In', sortOrder: 10, desktopCols: 2, mobileCols: 1 },
  {
    slug: 'round-1-day-1',
    label: 'Round 1, Day 1',
    sortOrder: 20,
    desktopCols: 4,
    mobileCols: 2,
  },
  {
    slug: 'round-1-day-2',
    label: 'Round 1, Day 2',
    sortOrder: 30,
    desktopCols: 4,
    mobileCols: 2,
  },
  { slug: 'round-2', label: 'Round 2', sortOrder: 40, desktopCols: 4, mobileCols: 2 },
  {
    slug: 'rounds-3-4',
    label: 'Rounds 3 & 4',
    sortOrder: 50,
    desktopCols: 3,
    mobileCols: 2,
  },
  {
    slug: 'final-four',
    label: 'Final Four',
    sortOrder: 60,
    desktopCols: 3,
    mobileCols: 1,
  },
  {
    slug: 'championship',
    label: 'Championship',
    sortOrder: 70,
    desktopCols: 1,
    mobileCols: 1,
  },
];
