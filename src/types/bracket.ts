export interface Team {
  id: string;
  name: string;
  seed: number;
  region: 'East' | 'West' | 'South' | 'Midwest';
  logoUrl?: string;
}

export interface Game {
  id: string;
  round: number;
  gameNumber: number;
  team1?: Team;
  team2?: Team;
  winner?: Team;
  score1?: number;
  score2?: number;
  date?: string;
  completed: boolean;
}

export interface Bracket {
  id: string;
  playerName: string;
  playerEmail: string;
  submittedAt: string;
  games: Game[];
  totalPoints: number;
  isComplete: boolean;
  isPublic: boolean;
}

export interface BracketSubmission {
  playerName: string;
  playerEmail: string;
  games: Omit<Game, 'id' | 'completed'>[];
}

export interface BracketValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TournamentConfig {
  regions: string[];
  rounds: {
    name: string;
    gamesPerRegion: number;
    points: number;
  }[];
  totalTeams: number;
  startDate: string;
  endDate: string;
}

