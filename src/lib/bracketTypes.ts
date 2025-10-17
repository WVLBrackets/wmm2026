import { Team, Game, Bracket, TournamentConfig } from '@/types/bracket';

/**
 * Default tournament configuration for 2026 March Madness
 */
export const TOURNAMENT_CONFIG: TournamentConfig = {
  regions: ['East', 'West', 'South', 'Midwest'],
  rounds: [
    { name: 'First Round', gamesPerRegion: 8, points: 1 },
    { name: 'Second Round', gamesPerRegion: 4, points: 2 },
    { name: 'Sweet 16', gamesPerRegion: 2, points: 4 },
    { name: 'Elite 8', gamesPerRegion: 1, points: 8 },
    { name: 'Final Four', gamesPerRegion: 0, points: 16 },
    { name: 'Championship', gamesPerRegion: 0, points: 32 }
  ],
  totalTeams: 64,
  startDate: '2026-03-18T12:00:00-05:00',
  endDate: '2026-04-07T21:00:00-05:00'
};

/**
 * Generate the complete bracket structure with all games
 */
export function generateBracketStructure(): Game[] {
  const games: Game[] = [];
  let gameId = 1;

  // Generate games for each region
  TOURNAMENT_CONFIG.regions.forEach((region, regionIndex) => {
    TOURNAMENT_CONFIG.rounds.forEach((round, roundIndex) => {
      if (round.gamesPerRegion > 0) {
        for (let gameNum = 1; gameNum <= round.gamesPerRegion; gameNum++) {
          games.push({
            id: `game-${gameId}`,
            round: roundIndex + 1,
            gameNumber: gameNum,
            completed: false
          });
          gameId++;
        }
      }
    });
  });

  // Add Final Four and Championship games
  games.push(
    { id: 'final-four-1', round: 5, gameNumber: 1, completed: false },
    { id: 'final-four-2', round: 5, gameNumber: 2, completed: false },
    { id: 'championship', round: 6, gameNumber: 1, completed: false }
  );

  return games;
}

/**
 * Calculate points for a bracket based on correct picks
 */
export function calculateBracketPoints(bracket: Bracket): number {
  let totalPoints = 0;
  
  bracket.games.forEach(game => {
    if (game.winner && game.completed) {
      const round = game.round;
      const points = TOURNAMENT_CONFIG.rounds[round - 1]?.points || 0;
      totalPoints += points;
    }
  });

  return totalPoints;
}

/**
 * Check if bracket submission is complete
 */
export function isBracketComplete(bracket: Bracket): boolean {
  return bracket.games.every(game => game.winner !== undefined);
}

/**
 * Get teams for a specific region and seed
 */
export function getTeamByRegionAndSeed(region: string, seed: number): Team {
  // This would typically come from a database or API
  // For now, return mock data
  return {
    id: `${region.toLowerCase()}-${seed}`,
    name: `${region} Team ${seed}`,
    seed,
    region: region as 'East' | 'West' | 'South' | 'Midwest',
    logoUrl: `/logos/teams/${seed}.png`
  };
}

