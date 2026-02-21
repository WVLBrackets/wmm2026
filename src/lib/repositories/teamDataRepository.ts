/**
 * Team Data Repository
 * 
 * Handles team reference data operations.
 * Team data is shared across all environments (uses production database).
 */

import type { TeamReferenceData } from '../types/database';

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
        SELECT key, id, name, mascot, logo, COALESCE(active, false) as active
        FROM team_reference_data
        WHERE COALESCE(active, false) = true
        ORDER BY CAST(id AS INTEGER)
      `;
    } else {
      result = await teamDataSql`
        SELECT key, id, name, mascot, logo, active
        FROM team_reference_data
        ORDER BY CAST(id AS INTEGER)
      `;
    }
    
    const teams: Record<string, TeamReferenceData> = {};
    
    for (const row of result.rows) {
      // Normalize boolean from database
      let activeBoolean: boolean;
      if (row.active === null || row.active === undefined) {
        activeBoolean = false;
      } else {
        activeBoolean = Boolean(row.active);
      }
      
      teams[row.key as string] = {
        id: row.id as string,
        name: row.name as string,
        mascot: (row.mascot as string) || undefined,
        logo: (row.logo as string) || '',
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
 * Update all team reference data (replaces existing)
 * 
 * @param teams - Record of team key to team data
 */
export async function updateTeamReferenceData(
  teams: Record<string, TeamReferenceData>
): Promise<void> {
  try {
    const { teamDataSql } = await import('../teamDataConnection');
    
    // Delete all existing teams
    await teamDataSql`DELETE FROM team_reference_data`;
    
    // Insert all teams
    const entries = Object.entries(teams);
    if (entries.length > 0) {
      for (const [key, team] of entries) {
        // Default active status based on key format
        const isActive = team.active ?? (!/^[0-9]+$/.test(key));
        
        await teamDataSql`
          INSERT INTO team_reference_data (key, id, name, mascot, logo, active, updated_at)
          VALUES (${key}, ${team.id}, ${team.name}, ${team.mascot || null}, ${team.logo || null}, ${isActive}, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE
          SET id = EXCLUDED.id,
              name = EXCLUDED.name,
              mascot = EXCLUDED.mascot,
              logo = EXCLUDED.logo,
              active = EXCLUDED.active,
              updated_at = CURRENT_TIMESTAMP
        `;
      }
    }
  } catch (error) {
    console.error('Error updating team reference data:', error);
    throw error;
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
      SET active = ${active}, updated_at = CURRENT_TIMESTAMP
      WHERE key = ${key}
    `;
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
