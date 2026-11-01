export interface StandingsEntry {
  rank: number;
  player: string;
  points: number;
  tbDiff: number;
  finalFour: string[];
  finals: string[];
  champion: string;
  tb: number;
  paid: boolean;
  /**
   * Live payment state when known (`paid` / `pending` / `unpaid`).
   * Older snapshots may omit this — UI falls back to {@link paid}.
   */
  paymentStatus?: string | null;
  /** Pool bracket id (live standings); daily sheet rows omit this and use resolve-bracket API. */
  bracketId?: string;
  /** Owner user id (live standings) — used for My Entries / YOURS, not display-name matching. */
  userId?: string;
}

/**
 * Points gap vs overall leader for display.
 * Leaders (tied or sole) omit the gap entirely — no `(0)`, dash, or "back".
 */
export function formatPointsGap(
  entryPoints: number,
  leaderPoints: number,
): { text: string | null; ariaLabel: string | null } {
  if (entryPoints >= leaderPoints) {
    return { text: null, ariaLabel: null };
  }
  const gap = leaderPoints - entryPoints;
  return {
    text: `(-${gap})`,
    ariaLabel: `${gap} points behind the leader`,
  };
}

/** Row 2 KEY cells E–H: actual regional champs (TL, BL, TR, BR). Blanks mean game not final yet. */
export type RegionalChampionKeyRow = [string, string, string, string];

export interface StandingsData {
  /** Year-specific slot displays; unresolved play-ins do not exist in the school DB. */
  teamLogos?: Record<string, string>;
  tournamentRevision?: number;
  day: string;
  entries: StandingsEntry[];
  lastUpdated: string;
  sheetLastModified?: string; // Actual Google Sheet modification time
  quarterfinalWinners?: string[]; // Col E-H: non-empty regional champs only (legacy / summaries)
  /** E2,F2,G2,H2 with blanks preserved — drives per-region Daily Standings shading. */
  regionalChampionKey?: RegionalChampionKeyRow;
  semifinalWinners?: string[]; // Col I-J: Semifinal winners (Finals)
  semifinalKey?: string[]; // Col I-J: Raw KEY values (including blanks)
  finalWinner?: string; // Col K: Final winner (Champion)
  eliminatedTeams?: string[]; // Column O: Teams that are out (P = TRUE)
  /**
   * True when KEY L2 holds a non-zero numeric tie-break total: Pts column shows differential (col D)
   * and sort uses tbDiff after points. Blank, `0`, or non-numeric L2 → show pick TB (col L); same
   * points share rank (no tbDiff ordering).
   */
  keyTieBreakerPopulated?: boolean;
  /** KEY results entered for scored games (Round of 64–Championship); drives “N of 63 Games Complete”. */
  keyGamesComplete?: number;
  /** Scored-game total for progress (usually 63). */
  keyGamesTotal?: number;
}

/**
 * Sort standings for display and assign ranks (1,1,3…). When `keyTieBreakerPopulated`, break ties on
 * points using tbDiff ascending; otherwise same points share a rank (stable by player name).
 */
export function sortAndRankStandingsEntries(
  entries: StandingsEntry[],
  keyTieBreakerPopulated: boolean
): StandingsEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (keyTieBreakerPopulated) {
      const d = a.tbDiff - b.tbDiff;
      if (d !== 0) return d;
    }
    return a.player.localeCompare(b.player, undefined, { sensitivity: 'base' });
  });

  let currentRank = 1;
  return sorted.map((e, i) => {
    if (i > 0) {
      const p = sorted[i - 1];
      const sameGroup =
        e.points === p.points && (!keyTieBreakerPopulated || e.tbDiff === p.tbDiff);
      if (!sameGroup) currentRank = i + 1;
    }
    return { ...e, rank: currentRank };
  });
}

/**
 * Third line of the daily Pts column: bracket TB from column L unless KEY L2 is a non-zero number,
 * then differential from column D.
 */
export function formatStandingsTieBreakerDisplay(entry: StandingsEntry, data: StandingsData): string {
  if (data.keyTieBreakerPopulated) {
    return `TB: ${entry.tbDiff}`;
  }
  return `TB: ${entry.tb}`;
}


export type {
  StandingsShade,
  StandingsBorderTone,
  ChampionDisplayColors,
} from '@/lib/pickResultChrome';

export {
  getRegionalChampionSquareShade,
  getFinalistBorderTone,
  getChampionDisplayColors,
  resolvePickResultTone,
} from '@/lib/pickResultChrome';

