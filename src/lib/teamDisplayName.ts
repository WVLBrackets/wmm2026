import type { TeamReferenceData } from '@/lib/types/database';
import type { TournamentData, TournamentTeam } from '@/types/tournament';
/**
 * Resolved label shown to users for a team reference row.
 * Uses `displayName` when set and non-empty; otherwise falls back to official `name` (School).
 */
export function getTeamReferenceDisplayName(
  team: Pick<TeamReferenceData, 'name'> & { displayName?: string | null }
): string {
  const d = team.displayName?.trim();
  return d && d.length > 0 ? d : team.name;
}

/**
 * Build a map of ESPN team id → display label for tournament enrichment.
 */
export function buildTeamIdToDisplayNameMap(
  teams: Record<string, TeamReferenceData>
): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of Object.values(teams)) {
    m.set(t.id, getTeamReferenceDisplayName(t));
  }
  return m;
}

/**
 * Build id → display label map from public `/api/team-data` array payload.
 * Prefer `customDisplayName` (raw DB override) when present so clearing an override
 * does not rely on stale resolved `displayName` from HTTP/in-memory caches.
 */
export function buildTeamIdToDisplayNameMapFromApi(
  teams: Array<{
    id: string;
    name: string;
    displayName?: string | null;
    customDisplayName?: string | null;
  }>
): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of teams) {
    const hasCustomKey = Object.prototype.hasOwnProperty.call(t, 'customDisplayName');
    const custom = t.customDisplayName != null ? String(t.customDisplayName).trim() : '';
    if (hasCustomKey) {
      m.set(t.id, custom.length > 0 ? custom : t.name);
      continue;
    }
    const d = t.displayName?.trim();
    m.set(t.id, d && d.length > 0 ? d : t.name);
  }
  return m;
}

/**
 * Replace tournament team `name` fields with reference display names when the team id is known.
 */
export function applyDisplayNamesToTournamentData(
  data: TournamentData,
  idToDisplay: Map<string, string>
): TournamentData {
  const mapTeam = (team: TournamentTeam): TournamentTeam => ({
    ...team,
    name: idToDisplay.get(team.id) ?? team.name,
  });
  return {
    ...data,
    regions: data.regions.map((r) => ({
      ...r,
      teams: r.teams.map(mapTeam),
    })),
  };
}