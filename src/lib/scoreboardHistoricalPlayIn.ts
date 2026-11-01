/**
 * Hard-coded First Four results for years whose field JSON omitted play-in slots.
 * 2026: Dayton results (source: NCAA First Four box scores).
 */

export type HistoricalPlayInSeed = {
  gameKey: string;
  region: string;
  seed: number;
  team1Id: string;
  team1Name: string;
  team2Id: string;
  team2Name: string;
  score1: number;
  score2: number;
  winnerId: string;
  /** Tipoff ISO (UTC), from BBS / NCAA schedule. */
  tipoffAt: string;
};

/**
 * 2026 First Four — Midwest 16, West 11, South 16, Midwest 11.
 * Winner ids match the resolved R64 slots in tournament-2026.json (5001–5004).
 */
export const HISTORICAL_PLAY_IN_2026: HistoricalPlayInSeed[] = [
  {
    gameKey: 'ff-2026-midwest-16',
    region: 'Midwest',
    seed: 16,
    team1Id: '5002',
    team1Name: 'Howard',
    team2Id: '2378',
    team2Name: 'UMBC',
    score1: 86,
    score2: 83,
    winnerId: '5002',
    tipoffAt: '2026-03-17T22:40:00.000Z',
  },
  {
    gameKey: 'ff-2026-west-11',
    region: 'West',
    seed: 11,
    team1Id: '5001',
    team1Name: 'Texas',
    team2Id: '152',
    team2Name: 'NC State',
    score1: 68,
    score2: 66,
    winnerId: '5001',
    tipoffAt: '2026-03-18T01:29:00.000Z',
  },
  {
    gameKey: 'ff-2026-south-16',
    region: 'South',
    seed: 16,
    team1Id: '5004',
    team1Name: 'Prairie View A&M',
    team2Id: '2329',
    team2Name: 'Lehigh',
    score1: 67,
    score2: 55,
    winnerId: '5004',
    tipoffAt: '2026-03-18T22:40:00.000Z',
  },
  {
    gameKey: 'ff-2026-midwest-11',
    region: 'Midwest',
    seed: 11,
    team1Id: '5003',
    team1Name: 'Miami (OH)',
    team2Id: '2567',
    team2Name: 'SMU',
    score1: 89,
    score2: 79,
    winnerId: '5003',
    tipoffAt: '2026-03-19T01:15:00.000Z',
  },
];

/**
 * Historical play-in seeds for a tournament year, if any.
 *
 * @param year - App tournament year
 */
/** 2027 First Four — filled after Selection Sunday / Dayton results. */
export const HISTORICAL_PLAY_IN_2027: HistoricalPlayInSeed[] = [];

export function historicalPlayInForYear(
  year: number,
): HistoricalPlayInSeed[] {
  if (year === 2026) return HISTORICAL_PLAY_IN_2026;
  if (year === 2027) return HISTORICAL_PLAY_IN_2027;
  return [];
}

/**
 * Synthetic First Four / resolved-slot ids → real ESPN logo file ids.
 * Keeps bracket KEY ids (5001–5004) while pointing cards at existing PNGs.
 */
export const SYNTHETIC_TEAM_LOGO_IDS: Record<string, string> = {
  '5001': '251', // Texas
  '5002': '47', // Howard
  '5003': '193', // Miami (OH)
  '5004': '2029', // Prairie View A&M
};
