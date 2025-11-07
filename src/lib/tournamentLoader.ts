import { TournamentData } from '@/types/tournament';

/**
 * Load tournament data from JSON file
 * Uses fs.readFileSync on server-side, fetch in browser
 */
export async function loadTournamentData(year: string = '2025'): Promise<TournamentData> {
  try {
    // Check if we're in a server environment (Node.js) or browser
    const isServer = typeof window === 'undefined';
    
    if (isServer) {
      // Server-side: Read directly from filesystem using dynamic require
      // This prevents fs from being bundled in client-side code
      const fs = require('fs');
      const path = require('path');
      
      const filePath = path.join(process.cwd(), 'public', 'data', `tournament-${year}.json`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Tournament data file not found: tournament-${year}.json`);
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent) as TournamentData;
    } else {
      // Client-side: Use fetch with relative URL
      const response = await fetch(`/data/tournament-${year}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load tournament data for ${year}`);
      }
      return await response.json();
    }
  } catch (error) {
    console.error('Error loading tournament data:', error);
    throw error;
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

