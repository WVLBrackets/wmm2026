/**
 * Bracket Repository
 * 
 * Handles all bracket-related database operations.
 * All queries are scoped to the current environment for isolation.
 */

import { sql } from '../databaseAdapter';
import crypto from 'crypto';
import { getCurrentEnvironment } from '../databaseConfig';
import { getSiteConfigFromGoogleSheets } from '../siteConfig';
import { FALLBACK_CONFIG } from '../fallbackConfig';
import type { Bracket, BracketWithUser, UpdateBracketInput } from '../types/database';

/**
 * Create a new bracket
 * 
 * @param userId - Owner's user ID
 * @param entryName - Display name for the bracket
 * @param tieBreaker - Tie breaker score prediction
 * @param picks - Initial picks (game ID -> team ID)
 * @returns Created bracket
 */
export async function createBracket(
  userId: string, 
  entryName: string, 
  tieBreaker?: number, 
  picks: Record<string, string> = {}
): Promise<Bracket> {
  const environment = getCurrentEnvironment();
  const bracketId = crypto.randomUUID();
  
  // Get tournament year from config
  let year = new Date().getFullYear();
  try {
    const config = await getSiteConfigFromGoogleSheets();
    if (config?.tournamentYear) {
      year = parseInt(config.tournamentYear);
    }
  } catch {
    if (FALLBACK_CONFIG.tournamentYear) {
      year = parseInt(FALLBACK_CONFIG.tournamentYear);
    }
  }
  
  // Get next bracket number for this year/environment
  const result = await sql`
    SELECT COALESCE(MAX(bracket_number), 0) + 1 as next_number
    FROM brackets
    WHERE year = ${year} AND environment = ${environment}
  `;
  
  const bracketNumber = result.rows[0].next_number;
  
  await sql`
    INSERT INTO brackets (id, user_id, entry_name, tie_breaker, picks, bracket_number, year, environment)
    VALUES (${bracketId}, ${userId}, ${entryName}, ${tieBreaker || null}, ${JSON.stringify(picks)}, ${bracketNumber}, ${year}, ${environment})
  `;
  
  return {
    id: bracketId,
    userId,
    entryName,
    tieBreaker,
    picks,
    status: 'draft',
    bracketNumber,
    year,
    environment,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get all brackets for a user
 * 
 * @param userId - User ID to get brackets for
 * @returns List of brackets ordered by creation date (newest first)
 */
export async function getBracketsByUserId(userId: string): Promise<Bracket[]> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM brackets 
    WHERE user_id = ${userId} AND environment = ${environment}
    ORDER BY created_at DESC
  `;
  
  return result.rows.map(mapRowToBracket);
}

/**
 * Get a bracket by ID
 * 
 * @param bracketId - Bracket ID to look up
 * @returns Bracket if found, null otherwise
 */
export async function getBracketById(bracketId: string): Promise<Bracket | null> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM brackets 
    WHERE id = ${bracketId} AND environment = ${environment}
  `;
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return mapRowToBracket(result.rows[0]);
}

/**
 * Update a bracket
 * 
 * @param bracketId - Bracket ID to update
 * @param updates - Fields to update
 * @returns Updated bracket, or null if not found
 */
export async function updateBracket(
  bracketId: string, 
  updates: UpdateBracketInput
): Promise<Bracket | null> {
  const environment = getCurrentEnvironment();
  
  const currentBracket = await getBracketById(bracketId);
  if (!currentBracket) {
    return null;
  }
  
  // Merge updates with current values
  const entryName = updates.entryName ?? currentBracket.entryName;
  const tieBreaker = updates.tieBreaker ?? currentBracket.tieBreaker;
  const picks = updates.picks ?? currentBracket.picks;
  const status = updates.status ?? currentBracket.status;
  const userId = updates.userId ?? currentBracket.userId;
  
  await sql`
    UPDATE brackets 
    SET 
      entry_name = ${entryName},
      tie_breaker = ${tieBreaker || null},
      picks = ${JSON.stringify(picks)},
      status = ${status},
      user_id = ${userId},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${bracketId} AND environment = ${environment}
  `;
  
  return await getBracketById(bracketId);
}

/**
 * Delete a bracket
 * 
 * @param bracketId - Bracket ID to delete
 * @returns True if deleted, false otherwise
 */
export async function deleteBracket(bracketId: string): Promise<boolean> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    DELETE FROM brackets 
    WHERE id = ${bracketId} AND environment = ${environment}
  `;
  
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get all brackets with user info (admin function)
 * 
 * @returns List of brackets with user email and name
 */
export async function getAllBrackets(): Promise<BracketWithUser[]> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT b.*, u.email as user_email, u.name as user_name
    FROM brackets b
    JOIN users u ON b.user_id = u.id
    WHERE b.environment = ${environment} AND u.environment = ${environment}
    ORDER BY b.created_at DESC
  `;
  
  return result.rows.map((row: Record<string, unknown>) => ({
    ...mapRowToBracket(row),
    userEmail: row.user_email as string,
    userName: row.user_name as string,
  }));
}

/**
 * Map database row to Bracket type
 */
function mapRowToBracket(row: Record<string, unknown>): Bracket {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    entryName: row.entry_name as string,
    tieBreaker: row.tie_breaker as number | undefined,
    picks: row.picks as Record<string, string>,
    status: row.status as string,
    bracketNumber: row.bracket_number as number,
    year: row.year as number,
    environment: row.environment as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
