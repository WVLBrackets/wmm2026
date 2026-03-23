/**
 * User Repository
 * 
 * Handles all user-related database operations.
 * All queries are scoped to the current environment for isolation.
 */

import { sql } from '../databaseAdapter';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getCurrentEnvironment } from '../databaseConfig';
import { initializeDatabase } from '../database/migrations';

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === '42703';
}
import type { User, BracketCounts, StandingsViewPreference } from '../types/database';
import { normalizeStoredDisplayName } from '../stringNormalize';
import { parseDbInstant } from '../dbInstant';

/**
 * Create a new user with email confirmation token
 * 
 * @param email - User's email address
 * @param name - User's display name
 * @param password - Plain text password (will be hashed)
 * @returns Created user with confirmation token
 * @throws Error if user already exists in this environment
 */
export async function createUser(email: string, name: string, password: string): Promise<User> {
  const environment = getCurrentEnvironment();
  const storedName = normalizeStoredDisplayName(name);
  
  // Auto-initialize database if tables don't exist
  try {
    await sql`SELECT 1 FROM users LIMIT 1`;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('does not exist') || 
      error.message.includes('relation') ||
      (error as { code?: string }).code === '42P01'
    )) {
      try {
        await initializeDatabase();
      } catch (initError) {
        console.error('[createUser] Failed to initialize database:', initError);
        throw new Error('Database initialization failed. Please contact the administrator.');
      }
    } else {
      throw error;
    }
  }
  
  // Check for existing user
  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${email} AND environment = ${environment}
  `;
  
  if (existingUser.rows.length > 0) {
    throw new Error('User already exists with this email in this environment');
  }

  // Hash password with bcrypt cost factor 12
  const hashedPassword = await bcrypt.hash(password, 12);
  
  // Generate confirmation token (24 hour expiry)
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  const userId = crypto.randomUUID();
  
  // Insert user
  await sql`
    INSERT INTO users (
      id, email, name, password, email_confirmed,
      confirmation_token, confirmation_expires, environment
    ) VALUES (
      ${userId}, ${email}, ${storedName}, ${hashedPassword}, false,
      ${confirmationToken}, 
      ${confirmationExpires.toISOString()},
      ${environment}
    )
  `;
  
  // Store confirmation token
  await sql`
    INSERT INTO tokens (token, user_id, expires, type, environment)
    VALUES (${confirmationToken}, ${userId}, ${confirmationExpires.toISOString()}, 'confirmation', ${environment})
  `;

  return {
    id: userId,
    email,
    name: storedName,
    password: hashedPassword,
    emailConfirmed: false,
    confirmationToken,
    confirmationExpires,
    environment,
    createdAt: new Date(),
  };
}

/**
 * Get a user by email address
 * 
 * @param email - Email to look up
 * @returns User if found, null otherwise
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM users WHERE email = ${email} AND environment = ${environment}
  `;
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return mapRowToUser(result.rows[0]);
}

/**
 * Ensure a local dev-bypass user record exists for the current environment.
 * Creates the user as email-confirmed when missing and returns the DB record.
 */
export async function ensureDevBypassUser(email: string, name: string): Promise<User> {
  const environment = getCurrentEnvironment();

  if (environment === 'local') {
    await ensureLocalEnvironmentConstraints();
  }

  // Ensure base schema exists before attempting user provisioning.
  try {
    await sql`SELECT 1 FROM users LIMIT 1`;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('does not exist') ||
      error.message.includes('relation') ||
      (error as { code?: string }).code === '42P01'
    )) {
      await initializeDatabase();
    } else {
      throw error;
    }
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return existing;
  }

  const storedName = normalizeStoredDisplayName(name);

  // Placeholder password is never used for bypass login.
  const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const userId = crypto.randomUUID();

  await sql`
    INSERT INTO users (
      id, email, name, password, email_confirmed, environment
    ) VALUES (
      ${userId}, ${email}, ${storedName}, ${placeholderPassword}, true, ${environment}
    )
  `;

  const created = await getUserByEmail(email);
  if (!created) {
    throw new Error('Failed to create dev bypass user record');
  }
  return created;
}

/**
 * Ensure a user exists for CSV bracket import in current environment.
 * Creates a confirmed user with placeholder password if missing.
 */
export async function ensureImportUserByEmail(email: string, name: string): Promise<User> {
  const environment = getCurrentEnvironment();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = normalizeStoredDisplayName(
    name || normalizedEmail.split('@')[0] || 'Imported User'
  );

  // Ensure schema is initialized if users table is missing.
  try {
    await sql`SELECT 1 FROM users LIMIT 1`;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('does not exist') ||
      error.message.includes('relation') ||
      (error as { code?: string }).code === '42P01'
    )) {
      await initializeDatabase();
    } else {
      throw error;
    }
  }

  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return existing;
  }

  const userId = crypto.randomUUID();
  const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

  await sql`
    INSERT INTO users (
      id, email, name, password, email_confirmed, environment
    ) VALUES (
      ${userId}, ${normalizedEmail}, ${normalizedName}, ${placeholderPassword}, true, ${environment}
    )
  `;

  const created = await getUserByEmail(normalizedEmail);
  if (!created) {
    throw new Error('Failed to create imported user');
  }
  return created;
}

/**
 * Ensures local APP_ENV can persist rows in legacy databases that still
 * restrict environment values to development/preview/production only.
 */
async function ensureLocalEnvironmentConstraints(): Promise<void> {
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_environment`;
  await sql`
    ALTER TABLE users ADD CONSTRAINT chk_users_environment
    CHECK (environment IN ('development', 'local', 'preview', 'production'))
  `;

  await sql`ALTER TABLE brackets DROP CONSTRAINT IF EXISTS chk_brackets_environment`;
  await sql`
    ALTER TABLE brackets ADD CONSTRAINT chk_brackets_environment
    CHECK (environment IN ('development', 'local', 'preview', 'production'))
  `;
}

/**
 * Get a user by ID
 * 
 * @param id - User ID to look up
 * @returns User if found, null otherwise
 */
export async function getUserById(id: string): Promise<User | null> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM users WHERE id = ${id} AND environment = ${environment}
  `;
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return mapRowToUser(result.rows[0]);
}

/**
 * Get all users (admin function)
 * 
 * @returns List of users without password field
 */
export async function getAllUsers(): Promise<Omit<User, 'password'>[]> {
  const environment = getCurrentEnvironment();
  
  try {
    const result = await sql`
      SELECT id, email, name, email_confirmed, created_at, last_login, environment
      FROM users 
      WHERE environment = ${environment}
      ORDER BY created_at DESC
    `;
    
    return result.rows.map((row: Record<string, unknown>) => {
      const lastLoginValue = row.last_login;
      return {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        emailConfirmed: row.email_confirmed as boolean,
        createdAt: parseDbInstant(row.created_at),
        lastLogin: lastLoginValue ? new Date(lastLoginValue as string) : null,
        environment: row.environment as string,
      };
    });
  } catch (error) {
    // Fallback if last_login column doesn't exist
    if (error instanceof Error && error.message.includes('last_login')) {
      const result = await sql`
        SELECT id, email, name, email_confirmed, created_at, environment
        FROM users 
        WHERE environment = ${environment}
        ORDER BY created_at DESC
      `;
      
      return result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        emailConfirmed: row.email_confirmed as boolean,
        createdAt: parseDbInstant(row.created_at),
        lastLogin: null,
        environment: row.environment as string,
      }));
    }
    throw error;
  }
}

/**
 * Delete a user and all associated data
 * 
 * @param userId - User ID to delete
 * @returns True if deleted, false otherwise
 * @throws Error if user has existing brackets
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const environment = getCurrentEnvironment();
  
  // Check for existing brackets
  const bracketCounts = await getUserBracketCounts(userId);
  if (bracketCounts.submitted > 0 || bracketCounts.inProgress > 0 || bracketCounts.deleted > 0) {
    throw new Error('Cannot delete user with existing brackets');
  }
  
  // Delete tokens first (foreign key constraint)
  await sql`
    DELETE FROM tokens 
    WHERE user_id = ${userId} AND environment = ${environment}
  `;
  
  // Delete user
  const result = await sql`
    DELETE FROM users 
    WHERE id = ${userId} AND environment = ${environment}
  `;
  
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get total user count (all environments)
 */
export async function getUserCount(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM users`;
  return parseInt(result.rows[0].count);
}

/**
 * Get confirmed user count for current environment
 */
export async function getConfirmedUserCount(): Promise<number> {
  const environment = getCurrentEnvironment();
  const result = await sql`
    SELECT COUNT(*) as count FROM users 
    WHERE email_confirmed = TRUE AND environment = ${environment}
  `;
  return parseInt(result.rows[0].count);
}

/**
 * Update user's last login timestamp
 * 
 * @param userId - User ID to update
 */
export async function updateLastLogin(userId: string): Promise<void> {
  const environment = getCurrentEnvironment();
  
  try {
    // Check if column exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name = 'last_login'
        AND table_schema = current_schema()
    `;
    
    if (columnCheck.rows.length === 0) {
      try {
        await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ`;
      } catch (addError) {
        if (addError instanceof Error && (
          !addError.message.includes('already exists') && 
          !addError.message.includes('duplicate column')
        )) {
          throw addError;
        }
      }
    }
    
    await sql`
      UPDATE users 
      SET last_login = ${new Date()}
      WHERE id = ${userId} AND environment = ${environment}
    `;
  } catch (error) {
    console.error('[updateLastLogin] Error (non-critical):', error);
  }
}

/**
 * Get bracket counts by status for a user
 * 
 * @param userId - User ID to get counts for
 * @returns Counts by status
 */
export async function getUserBracketCounts(userId: string): Promise<BracketCounts> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT 
      SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) as deleted_count
    FROM brackets
    WHERE user_id = ${userId} AND environment = ${environment}
  `;
  
  const row = result.rows[0] as Record<string, unknown>;
  return {
    submitted: Number(row.submitted_count) || 0,
    inProgress: Number(row.in_progress_count) || 0,
    deleted: Number(row.deleted_count) || 0,
  };
}

/**
 * Load bracket status counts for every user in the current environment in one query.
 * Use this for admin lists instead of calling {@link getUserBracketCounts} per user.
 *
 * @returns Map from user id to submitted / in-progress / deleted counts
 */
export async function getBracketCountsGroupedByUser(): Promise<Map<string, BracketCounts>> {
  const environment = getCurrentEnvironment();

  const result = await sql`
    SELECT
      user_id,
      COALESCE(SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END), 0) AS submitted_count,
      COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress_count,
      COALESCE(SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END), 0) AS deleted_count
    FROM brackets
    WHERE environment = ${environment}
    GROUP BY user_id
  `;

  const map = new Map<string, BracketCounts>();
  for (const row of result.rows as Record<string, unknown>[]) {
    map.set(String(row.user_id), {
      submitted: Number(row.submitted_count) || 0,
      inProgress: Number(row.in_progress_count) || 0,
      deleted: Number(row.deleted_count) || 0,
    });
  }
  return map;
}

/** Submitted-bracket stats for the profile modal (My Picks). */
export interface UserSubmittedBracketStats {
  /** Brackets with status = submitted */
  submittedCount: number;
  /** Distinct `year` values among submitted brackets (= tournaments played) */
  distinctSubmittedYears: number;
}

/**
 * Count submitted brackets and distinct tournament years for a user.
 */
export async function getUserSubmittedBracketStats(userId: string): Promise<UserSubmittedBracketStats> {
  const environment = getCurrentEnvironment();

  const result = await sql`
    SELECT
      COUNT(*)::int AS cnt,
      COUNT(DISTINCT year)::int AS distinct_years
    FROM brackets
    WHERE user_id = ${userId}
      AND environment = ${environment}
      AND status = 'submitted'
  `;

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    submittedCount: Number(row?.cnt) || 0,
    distinctSubmittedYears: Number(row?.distinct_years) || 0,
  };
}

/**
 * Update the user's display name (normalized). Returns null if no row updated.
 * @throws Error if the normalized name is empty
 */
export async function updateUserDisplayNameByEmail(
  email: string,
  displayName: string
): Promise<{ name: string } | null> {
  const stored = normalizeStoredDisplayName(displayName);
  if (!stored) {
    throw new Error('Display name cannot be empty');
  }

  const environment = getCurrentEnvironment();
  const result = await sql`
    UPDATE users
    SET name = ${stored}
    WHERE LOWER(email) = LOWER(${email}) AND environment = ${environment}
    RETURNING name
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return { name: result.rows[0].name as string };
}

/**
 * Returns the user's saved Standings view (`daily` | `live`), or `null` if unset (treat as daily).
 */
export async function getStandingsViewPreferenceByEmail(
  email: string
): Promise<StandingsViewPreference | null> {
  const state = await getStandingsPreferenceStateByEmail(email);
  if (!state) return null;
  return state.mode;
}

export interface StandingsPreferenceState {
  mode: StandingsViewPreference;
  liveStandingsWarningAcknowledged: boolean;
}

/**
 * Standings view mode plus whether the user completed the Live Standings disclaimer (button 1).
 */
export async function getStandingsPreferenceStateByEmail(
  email: string
): Promise<StandingsPreferenceState | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const pref = user.standingsViewPreference;
  const mode: StandingsViewPreference =
    pref === 'live' || pref === 'daily' ? pref : 'daily';
  return {
    mode,
    liveStandingsWarningAcknowledged: user.liveStandingsWarningAcknowledged === true,
  };
}

export interface UpdateStandingsPreferenceOptions {
  /** When true, sets `live_standings_warning_acknowledged` so the Live gate is not shown again. */
  acknowledgeLiveStandingsWarning?: boolean;
}

/**
 * Persists Standings view preference for the signed-in user (cross-device; survives logout/login).
 */
export async function updateStandingsViewPreferenceByEmail(
  email: string,
  mode: StandingsViewPreference,
  options?: UpdateStandingsPreferenceOptions
): Promise<boolean> {
  const environment = getCurrentEnvironment();
  const acknowledge = options?.acknowledgeLiveStandingsWarning === true;

  const runUpdate = async () => {
    if (acknowledge) {
      return await sql`
        UPDATE users
        SET standings_view_preference = ${mode},
            live_standings_warning_acknowledged = TRUE
        WHERE LOWER(email) = LOWER(${email}) AND environment = ${environment}
        RETURNING id
      `;
    }
    return await sql`
      UPDATE users
      SET standings_view_preference = ${mode}
      WHERE LOWER(email) = LOWER(${email}) AND environment = ${environment}
      RETURNING id
    `;
  };

  try {
    const result = await runUpdate();
    return result.rows.length > 0;
  } catch (error) {
    if (isUndefinedColumnError(error)) {
      await initializeDatabase();
      const retry = await runUpdate();
      return retry.rows.length > 0;
    }
    throw error;
  }
}

/**
 * Map database row to User type
 */
function mapRowToUser(row: Record<string, unknown>): User {
  const rawPref = row.standings_view_preference as string | null | undefined;
  let standingsViewPreference: StandingsViewPreference | undefined;
  if (rawPref === 'live' || rawPref === 'daily') {
    standingsViewPreference = rawPref;
  }

  const rawAck = row.live_standings_warning_acknowledged as boolean | null | undefined;
  const liveStandingsWarningAcknowledged =
    rawAck === true || rawAck === false ? rawAck : false;

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    password: row.password as string,
    emailConfirmed: row.email_confirmed as boolean,
    confirmationToken: row.confirmation_token as string | undefined,
    confirmationExpires: row.confirmation_expires
      ? parseDbInstant(row.confirmation_expires)
      : undefined,
    resetToken: row.reset_token as string | undefined,
    resetExpires: row.reset_expires ? parseDbInstant(row.reset_expires) : undefined,
    environment: row.environment as string,
    createdAt: parseDbInstant(row.created_at),
    lastLogin: row.last_login ? parseDbInstant(row.last_login) : undefined,
    standingsViewPreference: standingsViewPreference ?? undefined,
    liveStandingsWarningAcknowledged,
  };
}
