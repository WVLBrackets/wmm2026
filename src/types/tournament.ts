export interface TournamentTeam {
  id: string;
  name: string;
  seed: number;
  logo: string;
  region?: string; // Added for Final Four teams to show which region they came from
  mascot?: string;
}

export interface TournamentRegion {
  name: string;
  position: string; // "Top Left", "Bottom Left", "Top Right", "Bottom Right"
  teams: TournamentTeam[];
}

export interface TournamentData {
  year: string;
  name: string;
  regions: TournamentRegion[];
  finalFour: {
    location: string;
  };
  metadata: {
    startDate: string;
    scoring: Array<{
      round: string;
      points: number;
    }>;
  };
}

export interface TournamentGame {
  id: string;
  round: string;
  region?: string; // Only for regional games
  team1?: TournamentTeam;
  team2?: TournamentTeam;
  winner?: TournamentTeam;
  gameNumber: number;
}

export interface TournamentBracket {
  regions: {
    [regionName: string]: TournamentGame[];
  };
  finalFour: TournamentGame[];
  championship: TournamentGame;
}

export interface BracketSubmission {
  id: string;
  playerName: string;
  playerEmail: string;
  entryName: string;
  tieBreaker?: string;
  /** ISO time of last bracket row change (any field); use for "Last updated" for all statuses. */
  updatedAt?: string;
  submittedAt?: string;
  /** @deprecated Prefer `updatedAt` for "last modified"; this is only set for `in_progress` (alias of updatedAt). */
  lastSaved?: string;
  picks: {
    [gameId: string]: string; // teamId of picked winner
  };
  totalPoints?: number;
  status: 'in_progress' | 'submitted' | 'deleted';
  year?: number;
}
