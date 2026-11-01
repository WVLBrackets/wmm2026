/**
 * Database entity types
 * 
 * Shared type definitions for all database entities.
 * Shared database types for repositories and services.
 */

/**
 * User entity representing an authenticated user
 */
/** Stored in `users.standings_view_preference` when live standings feature is enabled. */
export type StandingsViewPreference = 'daily' | 'live';

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  emailConfirmed: boolean;
  confirmationToken?: string;
  confirmationExpires?: Date;
  resetToken?: string;
  resetExpires?: Date;
  environment: string;
  createdAt: Date;
  lastLogin?: Date | null;
  /** When set, default Standings page mode for logged-in users (see `show_live_standings` site config). */
  standingsViewPreference?: StandingsViewPreference;
  /** After user confirms `live_standings_warning` (button 1); stored in `users.live_standings_warning_acknowledged`. */
  liveStandingsWarningAcknowledged?: boolean;
}

/**
 * Token entity for email confirmation and password reset
 */
export interface ConfirmationToken {
  token: string;
  userId: string;
  expires: Date;
  type: 'confirmation' | 'reset' | 'auto_signin';
}

/**
 * Bracket entity representing a user's tournament bracket submission
 */
export interface Bracket {
  id: string;
  userId: string;
  entryName: string;
  tieBreaker?: number;
  picks: Record<string, string>;
  status: string;
  source?: string;
  bracketNumber: number;
  year: number;
  isKey?: boolean;
  lockUserId?: string | null;
  lockAcquiredAt?: Date | null;
  /** Set on each transition into `submitted`; cleared when status leaves `submitted`. */
  submittedAt?: Date | null;
  /** Payment tracking: null (unpaid), 'pending', or 'paid'. */
  paymentStatus?: string | null;
  /** FK to payments table when part of a payment batch. */
  paymentId?: string | null;
  environment: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bracket with user info for admin views
 */
export interface BracketWithUser extends Bracket {
  userEmail: string;
  userName: string;
}

/**
 * Team reference data for tournament teams
 */
export interface TeamReferenceData {
  id: string;
  /** Official school name (e.g. from ESPN). */
  name: string;
  /** Optional shorter label for UI; when unset, `name` is shown. */
  displayName?: string;
  mascot?: string;
  logo: string;
  active?: boolean;
}

/**
 * Input type for creating a new user
 */
export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Input type for updating a bracket
 */
export interface UpdateBracketInput {
  entryName?: string;
  tieBreaker?: number;
  picks?: Record<string, string>;
  status?: string;
  userId?: string;
  lockUserId?: string | null;
  lockAcquiredAt?: Date | null;
  /** When set (including `null`), overrides automatic submitted_at rules (e.g. CSV import). */
  submittedAt?: Date | null;
}

/**
 * Bracket counts by status for a user
 */
export interface BracketCounts {
  submitted: number;
  inProgress: number;
  deleted: number;
}

/**
 * Payment record for a Venmo/Zelle payment batch (brackets and/or additional dollars).
 */
export interface Payment {
  id: string;
  userId: string;
  userEmail: string;
  bracketIds: string[];
  bracketCount: number;
  /**
   * Additional payment in whole dollars (not bracket count).
   * Persisted as `payments.additional_count`.
   */
  additionalCount: number;
  additionalNote?: string;
  amountCents: number;
  /** Payment note snapshot (column `venmo_note` kept for legacy compatibility). */
  venmoNote?: string;
  /** Provider used for this request; legacy rows default to venmo. */
  paymentMethod?: 'venmo' | 'zelle';
  /** Recipient label at request time (Venmo @user or Zelle name · contact). */
  recipientSnapshot?: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  requestedAt: Date;
  confirmedAt?: Date | null;
  confirmedBy?: string | null;
  adminTransactionId?: string | null;
  adminNotes?: string | null;
  environment: string;
}
