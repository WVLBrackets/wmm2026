/**
 * Server-only: loads tournament JSON and overlays display names from the team reference DB.
 * Do not import this module from Client Components — it pulls in `pg` via the team data repository.
 */

import { loadTournamentData } from '@/lib/tournamentLoader';
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';
import {
  applyDisplayNamesToTournamentData,
  buildTeamIdToDisplayNameMap,
} from '@/lib/teamDisplayName';
import type { TournamentData } from '@/types/tournament';

export async function loadTournamentWithDisplayNames(year: string): Promise<TournamentData> {
  const [data, teams] = await Promise.all([
    loadTournamentData(year),
    getAllTeamReferenceData(false),
  ]);
  return applyDisplayNamesToTournamentData(data, buildTeamIdToDisplayNameMap(teams));
}
