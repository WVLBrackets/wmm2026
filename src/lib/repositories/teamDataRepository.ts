/**
 * Team Data Repository
 * 
 * Handles team reference data operations.
 * Team data is shared across all environments (uses production database).
 */

import type { TeamReferenceData } from '../types/database';

/** Public GET /api/team-data cache must drop when reference rows change. */
async function invalidatePublicTeamDataCache(): Promise<void> {
  const { invalidateTeamDataPublicCache } = await import('../teamDataPublicCache');
  invalidateTeamDataPublicCache();
}

function parseDisplayNameColumn(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Get all team reference data
 * 
 * @param activeOnly - If true, only returns teams marked as active
 * @returns Record of team key to team data
 */
export async function getAllTeamReferenceData(
  activeOnly: boolean = false
): Promise<Record<string, TeamReferenceData>> {
  try {
    const { teamDataSql } = await import('../teamDataConnection');
    let result;
    
    if (activeOnly) {
      result = await teamDataSql`
        SELECT key, id, name, display_name, mascot, logo, COALESCE(active, false) as active
        FROM team_reference_data
        WHERE COALESCE(active, false) = true
        ORDER BY CAST(id AS INTEGER)
      `;
    } else {
      result = await teamDataSql`
        SELECT key, id, name, display_name, mascot, logo, active
        FROM team_reference_data
        ORDER BY CAST(id AS INTEGER)
      `;
    }
    
    const teams: Record<string, TeamReferenceData> = {};
    
    for (const row of result.rows) {
      const r = row as {
        key: string;
        id: string;
        name: string;
        display_name: string | null;
        mascot: string | null;
        logo: string | null;
        active: boolean | null;
      };

      // Normalize boolean from database
      let activeBoolean: boolean;
      if (r.active === null || r.active === undefined) {
        activeBoolean = false;
      } else {
        activeBoolean = Boolean(r.active);
      }

      teams[r.key] = {
        id: r.id,
        name: r.name,
        displayName: parseDisplayNameColumn(r.display_name),
        mascot: r.mascot || undefined,
        logo: r.logo || '',
        active: activeBoolean,
      };
    }
    
    return teams;
  } catch (error) {
    console.error('Error getting team reference data:', error);
    
    // Return empty if table doesn't exist
    if (error instanceof Error && (
      error.message.includes('does not exist') || 
      error.message.includes('relation')
    )) {
      return {};
    }
    throw error;
  }
}

/**
 * Update all team reference data (replaces existing).
 * Uses batched INSERT in a transaction so saves stay fast (hundreds of teams).
 *
 * @param teams - Record of team key to team data
 */
export async function updateTeamReferenceData(
  teams: Record<string, TeamReferenceData>
): Promise<void> {
  const { getTeamDataPool } = await import('../teamDataConnection');
  const pool = await getTeamDataPool();
  const entries = Object.entries(teams);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM team_reference_data');

    const BATCH_SIZE = 80;
    const COLS_PER_ROW = 8;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const params: unknown[] = [];
      const valueSql = batch
        .map(([key, team], rowIdx) => {
          const isActive = team.active ?? (!/^[0-9]+$/.test(key));
          const displayNameForDb = team.displayName?.trim()
            ? team.displayName.trim()
            : null;
          const base = rowIdx * COLS_PER_ROW;
          const touchNow = new Date();
          params.push(
            key,
            team.id,
            team.name,
            displayNameForDb,
            team.mascot ?? null,
            team.logo ?? null,
            isActive,
            touchNow
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        })
        .join(', ');

      await client.query(
        `INSERT INTO team_reference_data (key, id, name, display_name, mascot, logo, active, updated_at)
         VALUES ${valueSql}`,
        params
      );
    }

    await client.query('COMMIT');
    await invalidatePublicTeamDataCache();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating team reference data:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a single team's active status
 * 
 * @param key - Team key
 * @param active - New active status
 */
export async function updateTeamActiveStatus(key: string, active: boolean): Promise<void> {
  try {
    const { teamDataSql } = await import('../teamDataConnection');
    
    await teamDataSql`
      UPDATE team_reference_data
      SET active = ${active}, updated_at = ${new Date()}
      WHERE key = ${key}
    `;
    await invalidatePublicTeamDataCache();
  } catch (error) {
    console.error('Error updating team active status:', error);
    throw error;
  }
}

/**
 * Delete a team from reference data
 * 
 * @param key - Team key to delete
 */
export async function deleteTeamReferenceData(key: string): Promise<void> {
  try {
    const { teamDataSql } = await import('../teamDataConnection');
    
    await teamDataSql`
      DELETE FROM team_reference_data
      WHERE key = ${key}
    `;
    await invalidatePublicTeamDataCache();
  } catch (error) {
    console.error('Error deleting team reference data:', error);
    throw error;
  }
}

/**
 * Sync team data from JSON file
 * 
 * @deprecated Database is now the source of truth. This is a no-op.
 */
export async function syncTeamDataFromJSON(): Promise<void> {
  // No-op for backward compatibility
  return;
}
