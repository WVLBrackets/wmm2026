export interface TournamentTeam {
  id: string;
  name: string;
  seed: number;
  logo: string;
  region?: string; // Added for Final Four teams to show which region they came from
  mascot?: string;
  /** Stable bracket slot id remains `id`; these are real school identities. */
  playIn?: {
    teams: [PlayInSchool, PlayInSchool];
    /** Optional admin label for the unresolved pair only; never used as pick identity. */
    displayName?: string;
    winnerId?: string;
  };
}

export interface PlayInSchool {
  id: string;
  name: string;
  logo: string;
}

export interface TournamentRegion {
  name: string;
  position: string; // "Top Left", "Bottom Left", "Top Right", "Bottom Right"
  teams: TournamentTeam[];
}

export interface TournamentData {
  schemaVersion?: 2;
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
  /** Presentation-only settings; may change after entries exist. */
  display?: {
    playInLogo?: PlayInLogoStyle;
  };
}

/** How an unresolved play-in pair's two logos share one square tile. */
export type PlayInLogoLayout =
  | 'side-by-side'
  | 'corner-overlap'
  | 'split-vertical'
  | 'split-diagonal'
  | 'corner-cut';

export interface PlayInLogoStyle {
  layout: PlayInLogoLayout;
  /** Each logo's size as % of the tile (corner layouts only). */
  scalePercent: number;
  /** White divider / halo width in 64-unit canvas units; 0 = none. */
  dividerWidth: number;
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
  /** Friendly numeric id for display / usage logging when the API provides it. */
  bracketNumber?: number;
  /** Payment tracking: null/undefined (unpaid), 'pending', or 'paid'. */
  paymentStatus?: string | null;
}
