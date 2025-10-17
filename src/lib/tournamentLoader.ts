import { TournamentData } from '@/types/tournament';

/**
 * Load tournament data from JSON file
 */
export async function loadTournamentData(year: string = '2025'): Promise<TournamentData> {
  try {
    const response = await fetch(`/data/tournament-${year}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load tournament data for ${year}`);
    }
    return await response.json();
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
  const bracket: any = {
    regions: {},
    finalFour: [],
    championship: null
  };

  // Generate games for each region (16 teams per region)
  regions.forEach(region => {
    const regionGames: any[] = [];
    
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

    bracket.regions[region.name] = regionGames;
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

