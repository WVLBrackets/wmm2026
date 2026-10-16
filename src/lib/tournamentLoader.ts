import { TournamentData } from '@/types/tournament';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

/**
 * Default year string when callers omit year (prefer site fallback over a stale literal).
 */
function defaultTournamentYear(): string {
  return String(FALLBACK_CONFIG.tournamentYear || new Date().getFullYear());
}

/**
 * Load tournament data from JSON file.
 * Uses fs.readFileSync on server-side, fetch in browser.
 * Throws when the file is missing — prefer {@link tryLoadTournamentData} for optional loads.
 *
 * @param year - Tournament year (e.g. "2027")
 */
export async function loadTournamentData(year?: string): Promise<TournamentData> {
  const resolvedYear = year || defaultTournamentYear();
  try {
    // Check if we're in a server environment (Node.js) or browser
    const isServer = typeof window === 'undefined';

    if (isServer) {
      // Server-side: Read directly from filesystem using dynamic require
      // This prevents fs from being bundled in client-side code
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');

      const filePath = path.join(process.cwd(), 'public', 'data', `tournament-${resolvedYear}.json`);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Tournament data file not found: tournament-${resolvedYear}.json`);
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent) as TournamentData;
    } else {
      // Client-side: Use fetch with relative URL
      const response = await fetch(`/data/tournament-${resolvedYear}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load tournament data for ${resolvedYear}`);
      }
      return await response.json();
    }
  } catch (error) {
    console.error('Error loading tournament data:', error);
    throw error;
  }
}

/**
 * Attempt to load tournament JSON without throwing when the field file is absent.
 * Missing files are a quiet null (no error log) — callers decide if that is expected
 * (`brackets_available=NO`) or an error (`brackets_available=YES`).
 *
 * @param year - Tournament year (e.g. "2027")
 * @returns Tournament data, or null if the file is missing / unreachable
 */
export async function tryLoadTournamentData(year?: string): Promise<TournamentData | null> {
  const resolvedYear = year || defaultTournamentYear();
  const isServer = typeof window === 'undefined';

  if (isServer) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const filePath = path.join(process.cwd(), 'public', 'data', `tournament-${resolvedYear}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent) as TournamentData;
    } catch (error) {
      console.warn(
        `[tournamentLoader] Failed to parse tournament-${resolvedYear}.json`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  try {
    const response = await fetch(`/data/tournament-${resolvedYear}.json`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      console.warn(
        `[tournamentLoader] Unexpected response loading tournament-${resolvedYear}.json: ${response.status}`
      );
      return null;
    }
    return (await response.json()) as TournamentData;
  } catch {
    return null;
  }
}

/**
 * Generate bracket structure for 64-team tournament
 */
export function generateTournamentBracket(tournamentData: TournamentData) {
  const regions = tournamentData.regions;
  const bracket: Record<string, unknown> = {
    regions: {},
    finalFour: [],
    championship: null
  };

  // Generate games for each region (16 teams per region)
  regions.forEach(region => {
    const regionGames: unknown[] = [];
    
    // Round of 64 (8 games)
    for (let i = 0; i < 8; i++) {
      const gameNumber = i + 1;
      regionGames.push({
        id: `${region.name}-r64-${gameNumber}`,
        round: 'Round of 64',
        region: region.name,
        team1: region.teams[i * 2],
        team2: region.teams[i * 2 + 1],
        gameNumber
      });
    }

    // Round of 32 (4 games)
    for (let i = 0; i < 4; i++) {
      const gameNumber = i + 1;
      regionGames.push({
        id: `${region.name}-r32-${gameNumber}`,
        round: 'Round of 32',
        region: region.name,
        gameNumber
      });
    }

    // Sweet 16 (2 games)
    for (let i = 0; i < 2; i++) {
      const gameNumber = i + 1;
      regionGames.push({
        id: `${region.name}-s16-${gameNumber}`,
        round: 'Sweet 16',
        region: region.name,
        gameNumber
      });
    }

    // Elite 8 (1 game)
    regionGames.push({
      id: `${region.name}-e8-1`,
      round: 'Elite 8',
      region: region.name,
      gameNumber: 1
    });

    (bracket.regions as Record<string, unknown>)[region.name] = regionGames;
  });

  // Final Four (2 games)
  bracket.finalFour = [
    {
      id: 'final-four-1',
      round: 'Final Four',
      gameNumber: 1
    },
    {
      id: 'final-four-2',
      round: 'Final Four',
      gameNumber: 2
    }
  ];

  // Championship
  bracket.championship = {
    id: 'championship',
    round: 'Championship',
    gameNumber: 1
  };

  return bracket;
}

/**
 * Get scoring points for a round
 */
export function getScoringPoints(round: string, tournamentData: TournamentData): number {
  const scoring = tournamentData.metadata.scoring.find(s => s.round === round);
  return scoring ? scoring.points : 0;
}
