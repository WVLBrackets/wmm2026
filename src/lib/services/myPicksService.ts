import type { Bracket } from '@/lib/types/database';
import type { TournamentData } from '@/types/tournament';
import {
  getUserBracketsForYear,
  listUserBracketYears,
} from '@/lib/repositories/bracketRepository';
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMap,
} from '@/lib/teamDisplayName';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import { mergeAvailableYears } from '@/lib/services/tournamentYearHelpers';

/** One My Picks list row (shape shared by the server page and `/api/tournament-bracket`). */
export interface MyPicksBracketRow {
  id: string;
  playerName: string;
  playerEmail: string;
  entryName: string;
  tieBreaker?: number;
  submittedAt?: string;
  updatedAt: string;
  lastSaved?: string;
  picks: Record<string, string>;
  totalPoints: number;
  isComplete: boolean;
  bracketNumber: number;
  year: number;
  isPublic: boolean;
  status: 'in_progress' | 'submitted' | 'deleted';
  paymentStatus: string | null;
}

/** My Picks list payload for one viewing year. */
export interface MyPicksListPayload {
  brackets: MyPicksBracketRow[];
  activeYear: number;
  viewingYear: number;
  availableYears: number[];
}

/**
 * Map a repository bracket to the My Picks row shape.
 *
 * @param bracket - DB bracket
 * @param owner - Owner display name + email
 */
export function toMyPicksRow(
  bracket: Bracket,
  owner: { name: string; email: string },
): MyPicksBracketRow {
  const status =
    bracket.status === 'submitted' || bracket.status === 'deleted'
      ? bracket.status
      : 'in_progress';
  return {
    id: bracket.id,
    playerName: owner.name,
    playerEmail: owner.email,
    entryName: bracket.entryName,
    tieBreaker: bracket.tieBreaker,
    submittedAt:
      status === 'submitted' && bracket.submittedAt
        ? bracket.submittedAt.toISOString()
        : undefined,
    updatedAt: bracket.updatedAt.toISOString(),
    lastSaved: status === 'in_progress' ? bracket.updatedAt.toISOString() : undefined,
    picks: bracket.picks,
    totalPoints: 0,
    isComplete: status === 'submitted',
    bracketNumber: bracket.bracketNumber,
    year: bracket.year,
    isPublic: status === 'submitted',
    status,
    paymentStatus: bracket.paymentStatus ?? null,
  };
}

/**
 * Load a user's brackets for one year plus the year-switcher list (two indexed queries).
 *
 * @param owner - User id, name, and email
 * @param viewingYear - Year being viewed
 * @param activeYear - Active Tourney Year (always in the switcher)
 */
export async function loadMyPicksList(
  owner: { id: string; name: string; email: string },
  viewingYear: number,
  activeYear: number,
): Promise<MyPicksListPayload> {
  const [rows, years] = await Promise.all([
    getUserBracketsForYear(owner.id, viewingYear),
    listUserBracketYears(owner.id),
  ]);
  return {
    brackets: rows.map((row) => toMyPicksRow(row, owner)),
    activeYear,
    viewingYear,
    availableYears: mergeAvailableYears(years, activeYear),
  };
}

/**
 * Published tournament field for a year with team-reference display names applied
 * (server-side equivalent of the old client `/api/team-data` enrichment).
 *
 * @param year - Tournament year
 * @returns Field data, or null when the year is not published
 */
export async function loadMyPicksField(year: number): Promise<TournamentData | null> {
  const field = await tryLoadTournamentData(String(year));
  if (!field) return null;
  try {
    const teams = await getAllTeamReferenceData(false);
    const active = Object.fromEntries(
      Object.entries(teams).filter(([, team]) => team.active !== false),
    );
    return applyDisplayNamesToTournamentData(field, buildTeamIdToDisplayNameMap(active));
  } catch (error) {
    console.warn('[My Picks] Team display names unavailable; using field names:', error);
    return field;
  }
}
