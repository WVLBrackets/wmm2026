import { TournamentData, TournamentGame, TournamentBracket } from '@/types/tournament';

/**
 * Generate complete 64-team bracket structure
 */
export function generate64TeamBracket(tournamentData: TournamentData): TournamentBracket {
  const regions = tournamentData.regions;
  const bracket: TournamentBracket = {
    regions: {},
    finalFour: [],
    championship: {
      id: 'championship',
      round: 'Championship',
      gameNumber: 1
    }
  };

  // Generate games for each region
  regions.forEach(region => {
    const regionGames: TournamentGame[] = [];
    
    // Round of 64 (8 games per region)
    for (let i = 0; i < 8; i++) {
      const gameNumber = i + 1;
      regionGames.push({
        id: `${region.position}-r64-${gameNumber}`,
        round: 'Round of 64',
        region: region.position,
        team1: region.teams[i * 2],
        team2: region.teams[i * 2 + 1],
        gameNumber
      });
    }

    // Round of 32 (4 games per region) - will be populated when Round of 64 winners are selected
    for (let i = 0; i < 4; i++) {
      const gameNumber = i + 1;
      regionGames.push({
        id: `${region.position}-r32-${gameNumber}`,
        round: 'Round of 32',
        region: region.position,
        gameNumber
      });
    }

    // Sweet 16 (2 games per region) - will be populated when Round of 32 winners are selected
    for (let i = 0; i < 2; i++) {
      const gameNumber = i + 1;
      regionGames.push({
        id: `${region.position}-s16-${gameNumber}`,
        round: 'Sweet 16',
        region: region.position,
        gameNumber
      });
    }

    // Elite 8 (1 game per region) - will be populated when Sweet 16 winners are selected
    regionGames.push({
        id: `${region.position}-e8-1`,
        round: 'Elite 8',
        region: region.position,
      gameNumber: 1
    });

    bracket.regions[region.position] = regionGames;
  });

  // Final Four (2 games) - will be populated when Elite 8 winners are selected
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

  return bracket;
}

/**
 * Get all games from a bracket in order
 */
export function getAllBracketGames(bracket: TournamentBracket): TournamentGame[] {
  const allGames: TournamentGame[] = [];
  
  // Add regional games
  Object.values(bracket.regions).forEach(regionGames => {
    allGames.push(...regionGames);
  });
  
  // Add Final Four games
  allGames.push(...bracket.finalFour);
  
  // Add championship
  allGames.push(bracket.championship);
  
  return allGames;
}

/**
 * Get games for a specific round
 */
export function getGamesByRound(bracket: TournamentBracket, round: string): TournamentGame[] {
  const allGames = getAllBracketGames(bracket);
  return allGames.filter(game => game.round === round);
}

/**
 * Get regional games for a specific region and round
 */
export function getRegionalGames(bracket: TournamentBracket, region: string, round: string): TournamentGame[] {
  const regionGames = bracket.regions[region] || [];
  return regionGames.filter(game => game.round === round);
}

/**
 * Update bracket games based on picks made
 */
export function updateBracketWithPicks(bracket: TournamentBracket, picks: { [gameId: string]: string }, tournamentData: TournamentData): TournamentBracket {
  const updatedBracket = JSON.parse(JSON.stringify(bracket)); // Deep clone
  
  // Update each region
  tournamentData.regions.forEach(region => {
    const regionGames = updatedBracket.regions[region.position];
    
    // Update Round of 32 games based on Round of 64 winners
    const roundOf64Games = regionGames.filter((game: TournamentGame) => game.round === 'Round of 64');
    const roundOf32Games = regionGames.filter((game: TournamentGame) => game.round === 'Round of 32');
    
    roundOf32Games.forEach((game: TournamentGame, index: number) => {
      const game1Index = index * 2;
      const game2Index = index * 2 + 1;
      
      const game1Winner = picks[roundOf64Games[game1Index]?.id];
      const game2Winner = picks[roundOf64Games[game2Index]?.id];
      
      // Populate teams individually as they're determined
      if (game1Winner) {
        const team1 = region.teams.find(t => t.id === game1Winner);
        game.team1 = team1;
      }
      if (game2Winner) {
        const team2 = region.teams.find(t => t.id === game2Winner);
        game.team2 = team2;
      }
    });
    
    // Update Sweet 16 games based on Round of 32 winners
    const sweet16Games = regionGames.filter((game: TournamentGame) => game.round === 'Sweet 16');
    
    sweet16Games.forEach((game: TournamentGame, index: number) => {
      const game1Index = index * 2;
      const game2Index = index * 2 + 1;
      
      const game1Winner = picks[roundOf32Games[game1Index]?.id];
      const game2Winner = picks[roundOf32Games[game2Index]?.id];
      
      // Populate teams individually as they're determined
      if (game1Winner) {
        const team1 = region.teams.find(t => t.id === game1Winner);
        game.team1 = team1;
      }
      if (game2Winner) {
        const team2 = region.teams.find(t => t.id === game2Winner);
        game.team2 = team2;
      }
    });
    
    // Update Elite 8 game based on Sweet 16 winners
    const elite8Game = regionGames.find((game: TournamentGame) => game.round === 'Elite 8');
    const sweet16Game1Winner = picks[sweet16Games[0]?.id];
    const sweet16Game2Winner = picks[sweet16Games[1]?.id];
    
    // Populate teams individually as they're determined
    if (sweet16Game1Winner) {
      const team1 = region.teams.find(t => t.id === sweet16Game1Winner);
      elite8Game.team1 = team1;
    }
    if (sweet16Game2Winner) {
      const team2 = region.teams.find(t => t.id === sweet16Game2Winner);
      elite8Game.team2 = team2;
    }
  });
  
  // Update Final Four based on Elite 8 winners
  const elite8Winners = tournamentData.regions.map(region => {
    const elite8Game = updatedBracket.regions[region.position].find((game: TournamentGame) => game.round === 'Elite 8');
    return picks[elite8Game?.id];
  });
  
  // Final Four Game 1: Top Left vs Bottom Left
  const topLeftWinner = elite8Winners[0];
  const bottomLeftWinner = elite8Winners[1];
  
  if (topLeftWinner) {
    const topLeftTeam = tournamentData.regions[0].teams.find(t => t.id === topLeftWinner);
    if (topLeftTeam) {
      topLeftTeam.region = tournamentData.regions[0].name;
      updatedBracket.finalFour[0].team1 = topLeftTeam;
    }
  }
  if (bottomLeftWinner) {
    const bottomLeftTeam = tournamentData.regions[1].teams.find(t => t.id === bottomLeftWinner);
    if (bottomLeftTeam) {
      bottomLeftTeam.region = tournamentData.regions[1].name;
      updatedBracket.finalFour[0].team2 = bottomLeftTeam;
    }
  }
  
  // Final Four Game 2: Top Right vs Bottom Right
  const topRightWinner = elite8Winners[2];
  const bottomRightWinner = elite8Winners[3];
  
  if (topRightWinner) {
    const topRightTeam = tournamentData.regions[2].teams.find(t => t.id === topRightWinner);
    if (topRightTeam) {
      topRightTeam.region = tournamentData.regions[2].name;
      updatedBracket.finalFour[1].team1 = topRightTeam;
    }
  }
  if (bottomRightWinner) {
    const bottomRightTeam = tournamentData.regions[3].teams.find(t => t.id === bottomRightWinner);
    if (bottomRightTeam) {
      bottomRightTeam.region = tournamentData.regions[3].name;
      updatedBracket.finalFour[1].team2 = bottomRightTeam;
    }
  }
  
  // Update Championship based on Final Four winners
  const finalFourGame1Winner = picks[updatedBracket.finalFour[0]?.id];
  const finalFourGame2Winner = picks[updatedBracket.finalFour[1]?.id];
  
  // Populate teams individually as they're determined
  if (finalFourGame1Winner) {
    const team1 = tournamentData.regions.flatMap(r => r.teams).find(t => t.id === finalFourGame1Winner);
    updatedBracket.championship.team1 = team1;
  }
  if (finalFourGame2Winner) {
    const team2 = tournamentData.regions.flatMap(r => r.teams).find(t => t.id === finalFourGame2Winner);
    updatedBracket.championship.team2 = team2;
  }
  
  return updatedBracket;
}
