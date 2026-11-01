/** Scoreboard of Record game status. */
export type ScoreboardGameStatus = 'scheduled' | 'live' | 'final';

/** Bracket game vs First Four play-in slot. */
export type ScoreboardGameKind = 'bracket' | 'first_four';

/** Who last wrote the row. */
export type ScoreboardGameSource = 'seed' | 'admin' | 'sync';

export type ScoreboardGame = {
  environment: string;
  year: number;
  gameKey: string;
  kind: ScoreboardGameKind;
  roundLabel: string;
  region: string | null;
  seed1: number | null;
  seed2: number | null;
  team1Id: string | null;
  team2Id: string | null;
  team1Name: string | null;
  team2Name: string | null;
  status: ScoreboardGameStatus;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  bbsMatchId: string | null;
  bbsHomeTeamId: string | null;
  bbsAwayTeamId: string | null;
  lastSyncedAt: Date | null;
  source: ScoreboardGameSource;
  adminLocked: boolean;
  updatedBy: string | null;
  /** Scheduled tipoff (UTC). */
  tipoffAt: Date | null;
  /** Live period label e.g. 1ST / OT. */
  periodLabel: string | null;
  /** Live clock remaining e.g. 4:32. */
  clock: string | null;
  /** Short note e.g. Awaiting tipoff / Delayed. */
  statusNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ScoreboardSettings = {
  environment: string;
  year: number;
  autoSyncEnabled: boolean;
  pollIntervalMinutes: number;
  bbsSeason: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  updatedAt: Date;
};

export type ScoreboardTeamMapRow = {
  environment: string;
  ourTeamId: string;
  bbsTeamId: string;
  bbsTeamName: string | null;
  updatedAt: Date;
};

/** Patch accepted by admin/sync upserts. */
export type ScoreboardGamePatch = {
  status?: ScoreboardGameStatus;
  score1?: number | null;
  score2?: number | null;
  winnerId?: string | null;
  team1Id?: string | null;
  team2Id?: string | null;
  team1Name?: string | null;
  team2Name?: string | null;
  seed1?: number | null;
  seed2?: number | null;
  roundLabel?: string;
  region?: string | null;
  kind?: ScoreboardGameKind;
  bbsMatchId?: string | null;
  bbsHomeTeamId?: string | null;
  bbsAwayTeamId?: string | null;
  adminLocked?: boolean;
  tipoffAt?: Date | string | null;
  periodLabel?: string | null;
  clock?: string | null;
  statusNote?: string | null;
};
