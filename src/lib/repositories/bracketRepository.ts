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

const KEY_ENTRY_NAME = 'KEY';
const KEY_LOCK_TIMEOUT_MINUTES = 30;

interface BracketQueryOptions {
  includeKey?: boolean;
}

async function getNextBracketNumber(year: number, environment: string): Promise<number> {
  const result = await sql`
    SELECT COALESCE(MAX(bracket_number), 0) + 1 as next_number
    FROM brackets
    WHERE year = ${year} AND environment = ${environment}
  `;
  return result.rows[0].next_number as number;
}

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
  picks: Record<string, string> = {},
  yearOverride?: number
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
  
  if (yearOverride) {
    year = yearOverride;
  }

  const bracketNumber = await getNextBracketNumber(year, environment);
  
  await sql`
    INSERT INTO brackets (id, user_id, entry_name, tie_breaker, picks, bracket_number, year, environment, is_key)
    VALUES (${bracketId}, ${userId}, ${entryName}, ${tieBreaker || null}, ${JSON.stringify(picks)}, ${bracketNumber}, ${year}, ${environment}, FALSE)
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
    isKey: false,
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
export async function getBracketsByUserId(userId: string, options?: BracketQueryOptions): Promise<Bracket[]> {
  const environment = getCurrentEnvironment();
  const includeKey = options?.includeKey === true;
  
  const result = includeKey
    ? await sql`
        SELECT * FROM brackets 
        WHERE user_id = ${userId} AND environment = ${environment}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT * FROM brackets 
        WHERE user_id = ${userId} AND environment = ${environment}
          AND COALESCE(is_key, FALSE) = FALSE
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
  const lockUserId = updates.lockUserId !== undefined ? updates.lockUserId : currentBracket.lockUserId;
  const lockAcquiredAt = updates.lockAcquiredAt !== undefined ? updates.lockAcquiredAt : currentBracket.lockAcquiredAt;
  
  await sql`
    UPDATE brackets 
    SET 
      entry_name = ${entryName},
      tie_breaker = ${tieBreaker || null},
      picks = ${JSON.stringify(picks)},
      status = ${status},
      user_id = ${userId},
      lock_user_id = ${lockUserId || null},
      lock_acquired_at = ${lockAcquiredAt || null},
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
export async function getAllBrackets(options?: BracketQueryOptions): Promise<BracketWithUser[]> {
  const environment = getCurrentEnvironment();
  const includeKey = options?.includeKey === true;
  
  const result = includeKey
    ? await sql`
        SELECT b.*, u.email as user_email, u.name as user_name
        FROM brackets b
        JOIN users u ON b.user_id = u.id
        WHERE b.environment = ${environment} AND u.environment = ${environment}
        ORDER BY b.created_at DESC
      `
    : await sql`
        SELECT b.*, u.email as user_email, u.name as user_name
        FROM brackets b
        JOIN users u ON b.user_id = u.id
        WHERE b.environment = ${environment}
          AND u.environment = ${environment}
          AND COALESCE(b.is_key, FALSE) = FALSE
        ORDER BY b.created_at DESC
      `;
  
  return result.rows.map((row: Record<string, unknown>) => ({
    ...mapRowToBracket(row),
    userEmail: row.user_email as string,
    userName: row.user_name as string,
  }));
}

/**
 * Get the KEY bracket for a specific year in the current environment.
 */
export async function getKeyBracketByYear(year: number): Promise<Bracket | null> {
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT * FROM brackets
    WHERE environment = ${environment}
      AND year = ${year}
      AND is_key = TRUE
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return null;
  }
  return mapRowToBracket(result.rows[0]);
}

/**
 * Create the KEY bracket for a year if it does not already exist.
 * Returns the existing or newly-created bracket.
 */
export async function getOrCreateKeyBracket(year: number, adminUserId: string): Promise<Bracket> {
  const environment = getCurrentEnvironment();
  const existing = await getKeyBracketByYear(year);
  if (existing) {
    return existing;
  }

  const bracketId = crypto.randomUUID();
  const bracketNumber = await getNextBracketNumber(year, environment);

  try {
    await sql`
      INSERT INTO brackets (
        id,
        user_id,
        entry_name,
        tie_breaker,
        picks,
        status,
        bracket_number,
        year,
        environment,
        is_key
      )
      VALUES (
        ${bracketId},
        ${adminUserId},
        ${KEY_ENTRY_NAME},
        ${null},
        ${JSON.stringify({})},
        ${'draft'},
        ${bracketNumber},
        ${year},
        ${environment},
        ${true}
      )
    `;
  } catch {
    // Handle race conditions where another request created KEY first.
  }

  const keyBracket = await getKeyBracketByYear(year);
  if (!keyBracket) {
    throw new Error('Failed to create or load KEY bracket');
  }
  return keyBracket;
}

/**
 * Attempt to acquire the edit lock for a KEY bracket.
 * Lock can be acquired if unclaimed, stale, or already held by same user.
 */
export async function acquireKeyBracketLock(
  bracketId: string,
  adminUserId: string
): Promise<{ acquired: boolean; lockedByUserId?: string | null }> {
  const bracket = await getBracketById(bracketId);
  if (!bracket || !bracket.isKey) {
    return { acquired: false };
  }

  const now = new Date();
  const lockAgeMs = bracket.lockAcquiredAt ? now.getTime() - bracket.lockAcquiredAt.getTime() : Infinity;
  const lockIsStale = lockAgeMs > KEY_LOCK_TIMEOUT_MINUTES * 60 * 1000;
  const canTakeLock =
    !bracket.lockUserId ||
    bracket.lockUserId === adminUserId ||
    lockIsStale;

  if (!canTakeLock) {
    return { acquired: false, lockedByUserId: bracket.lockUserId };
  }

  await updateBracket(bracketId, {
    lockUserId: adminUserId,
    lockAcquiredAt: now,
  });

  return { acquired: true };
}

/**
 * Release KEY bracket lock (only lock owner may release).
 */
export async function releaseKeyBracketLock(bracketId: string, adminUserId: string): Promise<boolean> {
  const bracket = await getBracketById(bracketId);
  if (!bracket || !bracket.isKey) {
    return false;
  }
  if (bracket.lockUserId && bracket.lockUserId !== adminUserId) {
    return false;
  }

  const updated = await updateBracket(bracketId, {
    lockUserId: null,
    lockAcquiredAt: null,
  });
  return !!updated;
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
    isKey: (row.is_key as boolean | null) ?? false,
    lockUserId: (row.lock_user_id as string | null) ?? null,
    lockAcquiredAt: row.lock_acquired_at ? new Date(row.lock_acquired_at as string) : null,
    environment: row.environment as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
