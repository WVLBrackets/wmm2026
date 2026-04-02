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
import { normalizeStoredDisplayName } from '../stringNormalize';
import { parseDbInstant } from '../dbInstant';

const KEY_ENTRY_NAME = 'KEY';
const KEY_LOCK_TIMEOUT_MINUTES = 30;

interface BracketQueryOptions {
  includeKey?: boolean;
}

let bracketLiveResultsColumnsEnsured = false;

async function ensureBracketLiveResultsColumns(): Promise<void> {
  if (bracketLiveResultsColumnsEnsured) {
    return;
  }

  try {
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS is_key BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_user_id VARCHAR(36)`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS source VARCHAR(50)`;
    await sql`UPDATE brackets SET is_key = FALSE WHERE is_key IS NULL`;
    await sql`UPDATE brackets SET source = 'site' WHERE source IS NULL OR source = ''`;
    await sql`ALTER TABLE brackets ALTER COLUMN is_key SET DEFAULT FALSE`;
    await sql`ALTER TABLE brackets ALTER COLUMN is_key SET NOT NULL`;
    await sql`ALTER TABLE brackets ALTER COLUMN source SET DEFAULT 'site'`;
    await sql`ALTER TABLE brackets ALTER COLUMN source SET NOT NULL`;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brackets_one_key_per_year_env
      ON brackets (year, environment)
      WHERE is_key = TRUE
    `;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`;
    await sql`
      UPDATE brackets
      SET submitted_at = updated_at
      WHERE status = 'submitted' AND submitted_at IS NULL
    `;
    bracketLiveResultsColumnsEnsured = true;
  } catch (error) {
    // Do not hard-fail normal bracket reads if schema migration cannot run here.
    console.warn('[ensureBracketLiveResultsColumns] Non-blocking migration check failed:', error);
  }
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
  const storedEntryName = normalizeStoredDisplayName(entryName);
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
    INSERT INTO brackets (id, user_id, entry_name, tie_breaker, picks, bracket_number, year, environment, is_key, source)
    VALUES (${bracketId}, ${userId}, ${storedEntryName}, ${tieBreaker || null}, ${JSON.stringify(picks)}, ${bracketNumber}, ${year}, ${environment}, FALSE, 'site')
  `;
  
  return {
    id: bracketId,
    userId,
    entryName: storedEntryName,
    tieBreaker,
    picks,
    status: 'draft',
    bracketNumber,
    year,
    isKey: false,
    source: 'site',
    submittedAt: null,
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

  await ensureBracketLiveResultsColumns();

  let result;
  try {
    result = includeKey
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
  } catch (error) {
    // Backward-compatible fallback if deployed code reaches a DB without new columns.
    if (error instanceof Error && error.message.includes('is_key')) {
      result = await sql`
        SELECT * FROM brackets 
        WHERE user_id = ${userId} AND environment = ${environment}
        ORDER BY created_at DESC
      `;
    } else {
      throw error;
    }
  }
  
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
 * Resolve a single submitted pool bracket id from a standings row label (entry name or display name).
 * Returns null if zero or ambiguous matches.
 */
export async function findSubmittedPoolBracketIdByLabel(year: number, label: string): Promise<string | null> {
  const environment = getCurrentEnvironment();
  const t = label.trim();
  if (!t) return null;

  const result = await sql`
    SELECT b.id
    FROM brackets b
    INNER JOIN users u ON u.id = b.user_id
    WHERE b.year = ${year}
      AND b.environment = ${environment}
      AND b.status = 'submitted'
      AND COALESCE(b.is_key, FALSE) = FALSE
      AND (
        LOWER(TRIM(b.entry_name)) = LOWER(${t})
        OR LOWER(TRIM(COALESCE(u.name, ''))) = LOWER(${t})
      )
    LIMIT 2
  `;

  if (result.rows.length !== 1) {
    return null;
  }

  return String((result.rows[0] as { id: string }).id);
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

  await ensureBracketLiveResultsColumns();
  
  const currentBracket = await getBracketById(bracketId);
  if (!currentBracket) {
    return null;
  }
  
  // Merge updates with current values
  const entryName =
    updates.entryName !== undefined
      ? normalizeStoredDisplayName(updates.entryName)
      : currentBracket.entryName;
  const tieBreaker = updates.tieBreaker ?? currentBracket.tieBreaker;
  const picks = updates.picks ?? currentBracket.picks;
  const status = updates.status ?? currentBracket.status;
  const userId = updates.userId ?? currentBracket.userId;
  const lockUserId = updates.lockUserId !== undefined ? updates.lockUserId : currentBracket.lockUserId;
  const lockAcquiredAt = updates.lockAcquiredAt !== undefined ? updates.lockAcquiredAt : currentBracket.lockAcquiredAt;

  const previousStatus = currentBracket.status;
  const nextStatus = status;
  let nextSubmittedAt: Date | null =
    currentBracket.submittedAt != null ? currentBracket.submittedAt : null;
  if (updates.submittedAt !== undefined) {
    nextSubmittedAt = updates.submittedAt;
  } else if (nextStatus === 'submitted' && previousStatus !== 'submitted') {
    nextSubmittedAt = new Date();
  } else if (nextStatus !== 'submitted') {
    nextSubmittedAt = null;
  }

  const touchNow = new Date();

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
      submitted_at = ${nextSubmittedAt},
      updated_at = ${touchNow}
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

  await ensureBracketLiveResultsColumns();

  let result;
  try {
    result = includeKey
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('is_key')) {
      result = await sql`
        SELECT b.*, u.email as user_email, u.name as user_name
        FROM brackets b
        JOIN users u ON b.user_id = u.id
        WHERE b.environment = ${environment}
          AND u.environment = ${environment}
        ORDER BY b.created_at DESC
      `;
    } else {
      throw error;
    }
  }
  
  return result.rows.map((row: Record<string, unknown>) => ({
    ...mapRowToBracket(row),
    userEmail: row.user_email as string,
    userName: row.user_name as string,
  }));
}

/**
 * Submitted, non-KEY brackets for a tournament year (for live standings scoring).
 */
export async function getSubmittedBracketsForLiveStandingsYear(
  year: number
): Promise<BracketWithUser[]> {
  await ensureBracketLiveResultsColumns();
  const environment = getCurrentEnvironment();

  const result = await sql`
    SELECT b.*, u.email as user_email, u.name as user_name
    FROM brackets b
    JOIN users u ON b.user_id = u.id
    WHERE b.environment = ${environment}
      AND u.environment = ${environment}
      AND b.year = ${year}
      AND b.status = 'submitted'
      AND COALESCE(b.is_key, FALSE) = FALSE
    ORDER BY b.entry_name ASC, b.id ASC
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
  await ensureBracketLiveResultsColumns();
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
  await ensureBracketLiveResultsColumns();
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
        is_key,
        source
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
        ${true},
        ${'site'}
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
    source: (row.source as string | null) ?? 'site',
    bracketNumber: row.bracket_number as number,
    year: row.year as number,
    isKey: (row.is_key as boolean | null) ?? false,
    lockUserId: (row.lock_user_id as string | null) ?? null,
    lockAcquiredAt: row.lock_acquired_at ? parseDbInstant(row.lock_acquired_at) : null,
    submittedAt: (() => {
      const raw = row.submitted_at;
      if (raw == null || raw === '') return null;
      const d = parseDbInstant(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    })(),
    environment: row.environment as string,
    createdAt: parseDbInstant(row.created_at),
    updatedAt: parseDbInstant(row.updated_at),
  };
}
