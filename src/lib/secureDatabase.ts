import { sql } from './databaseAdapter';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getCurrentEnvironment, getDatabaseConfig } from './databaseConfig';
import { getSiteConfigFromGoogleSheets } from './siteConfig';
import { FALLBACK_CONFIG } from './fallbackConfig';

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
}

export interface ConfirmationToken {
  token: string;
  userId: string;
  expires: Date;
  type: 'confirmation' | 'reset';
}

// Initialize database tables with environment isolation
export async function initializeDatabase() {
  try {
    // Ensure the database configuration is set up
    getDatabaseConfig();
    const environment = getCurrentEnvironment();
    
    // Create users table with environment isolation
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        email_confirmed BOOLEAN DEFAULT FALSE,
        confirmation_token VARCHAR(64),
        confirmation_expires TIMESTAMP,
        reset_token VARCHAR(64),
        reset_expires TIMESTAMP,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        UNIQUE(email, environment)
      )
    `;

    // Add last_login column if it doesn't exist (for existing databases)
    // PostgreSQL doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
    // So we check first, then add if needed
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
      `;
      
      if (columnCheck.rows.length === 0) {
        await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP`;
        console.log('Added last_login column to users table');
      }
    } catch (error) {
      console.log('Error checking/adding last_login column:', error);
      // Continue anyway - column might exist or table might not exist yet
    }

    // Create tokens table with environment isolation
    await sql`
      CREATE TABLE IF NOT EXISTS tokens (
        token VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        expires TIMESTAMP NOT NULL,
        type VARCHAR(20) NOT NULL,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create brackets table with environment isolation
    await sql`
      CREATE TABLE IF NOT EXISTS brackets (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        entry_name VARCHAR(255) NOT NULL,
        tie_breaker INTEGER,
        picks JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        bracket_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(bracket_number, year, environment)
      )
    `;

    // Create admin actions table for audit trail
    await sql`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id VARCHAR(36) PRIMARY KEY,
        admin_user_id VARCHAR(36) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        target_user_id VARCHAR(36),
        target_bracket_id VARCHAR(36),
        details JSONB,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create environment-specific indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email_env ON users(email, environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_environment ON users(environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_user_id_env ON tokens(user_id, environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_brackets_user_id_env ON brackets(user_id, environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_brackets_environment ON brackets(environment)`;

    // Add environment constraints (PostgreSQL doesn't support IF NOT EXISTS with ADD CONSTRAINT)
    try {
      await sql`
        ALTER TABLE users ADD CONSTRAINT chk_users_environment 
        CHECK (environment IN ('development', 'preview', 'production'))
      `;
    } catch (error) {
      // Constraint might already exist, ignore the error
      console.log('Users constraint might already exist:', error);
    }
    
    try {
      await sql`
        ALTER TABLE brackets ADD CONSTRAINT chk_brackets_environment 
        CHECK (environment IN ('development', 'preview', 'production'))
      `;
    } catch (error) {
      // Constraint might already exist, ignore the error
      console.log('Brackets constraint might already exist:', error);
    }

    console.log(`Database initialized successfully for environment: ${environment}`);
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const environment = getCurrentEnvironment();
  
  // Check if user already exists in THIS environment only
  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${email} AND environment = ${environment}
  `;
  
  if (existingUser.rows.length > 0) {
    throw new Error('User already exists with this email in this environment');
  }

  // Hash password with high security
  const hashedPassword = await bcrypt.hash(password, 12);
  
  // Generate confirmation token
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Only auto-confirm in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const userId = crypto.randomUUID();
  
  // Insert user with environment
  await sql`
    INSERT INTO users (
      id, email, name, password, email_confirmed,
      confirmation_token, confirmation_expires, environment
    ) VALUES (
      ${userId}, ${email}, ${name}, ${hashedPassword}, ${isDevelopment},
      ${isDevelopment ? null : confirmationToken}, 
      ${isDevelopment ? null : confirmationExpires.toISOString()},
      ${environment}
    )
  `;
  
  // Store confirmation token only if not in development mode
  if (!isDevelopment) {
    await sql`
      INSERT INTO tokens (token, user_id, expires, type, environment)
      VALUES (${confirmationToken}, ${userId}, ${confirmationExpires.toISOString()}, 'confirmation', ${environment})
    `;
  }

  return {
    id: userId,
    email,
    name,
    password: hashedPassword,
    emailConfirmed: isDevelopment,
    confirmationToken: isDevelopment ? undefined : confirmationToken,
    confirmationExpires: isDevelopment ? undefined : confirmationExpires,
    environment,
    createdAt: new Date(),
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM users WHERE email = ${email} AND environment = ${environment}
  `;
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    password: row.password,
    emailConfirmed: row.email_confirmed,
    confirmationToken: row.confirmation_token,
    confirmationExpires: row.confirmation_expires ? new Date(row.confirmation_expires) : undefined,
    resetToken: row.reset_token,
    resetExpires: row.reset_expires ? new Date(row.reset_expires) : undefined,
    environment: row.environment,
    createdAt: new Date(row.created_at),
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM users WHERE id = ${id} AND environment = ${environment}
  `;
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    password: row.password,
    emailConfirmed: row.email_confirmed,
    confirmationToken: row.confirmation_token,
    confirmationExpires: row.confirmation_expires ? new Date(row.confirmation_expires) : undefined,
    resetToken: row.reset_token,
    resetExpires: row.reset_expires ? new Date(row.reset_expires) : undefined,
    environment: row.environment,
    createdAt: new Date(row.created_at),
  };
}

export async function confirmUserEmail(token: string): Promise<boolean> {
  try {
    const environment = getCurrentEnvironment();
    
    // Find token in current environment
    const tokenResult = await sql`
      SELECT * FROM tokens 
      WHERE token = ${token} AND type = 'confirmation' AND expires > NOW() AND environment = ${environment}
    `;
    
    if (tokenResult.rows.length === 0) {
      return false;
    }
    
    const tokenRow = tokenResult.rows[0];
    
    // Update user to confirmed
    await sql`
      UPDATE users 
      SET email_confirmed = TRUE, confirmation_token = NULL, confirmation_expires = NULL
      WHERE id = ${tokenRow.user_id}
    `;
    
    // Remove token
    await sql`
      DELETE FROM tokens WHERE token = ${token}
    `;
    
    return true;
  } catch (error) {
    console.error('Error confirming user email:', error);
    return false;
  }
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const environment = getCurrentEnvironment();
  const user = await getUserByEmail(email);
  if (!user) {
    return null;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Update user with reset token
  await sql`
    UPDATE users 
    SET reset_token = ${resetToken}, reset_expires = ${resetExpires.toISOString()}
    WHERE id = ${user.id}
  `;

  // Store token in tokens table
  await sql`
    INSERT INTO tokens (token, user_id, expires, type, environment)
    VALUES (${resetToken}, ${user.id}, ${resetExpires.toISOString()}, 'reset', ${environment})
  `;

  return resetToken;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const environment = getCurrentEnvironment();
    
    // Find valid reset token in current environment
    const tokenResult = await sql`
      SELECT * FROM tokens 
      WHERE token = ${token} AND type = 'reset' AND expires > NOW() AND environment = ${environment}
    `;
    
    if (tokenResult.rows.length === 0) {
      return false;
    }
    
    const tokenRow = tokenResult.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user password and clear reset token
    await sql`
      UPDATE users 
      SET password = ${hashedPassword}, reset_token = NULL, reset_expires = NULL
      WHERE id = ${tokenRow.user_id} AND environment = ${environment}
    `;
    
    // Remove token
    await sql`
      DELETE FROM tokens WHERE token = ${token}
    `;
    
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  }
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return null;
    }

    if (!user.emailConfirmed) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    // Update last_login timestamp on successful login
    // This is a non-critical update, so we don't fail login if it errors
    try {
      const environment = getCurrentEnvironment();
      await sql`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = ${user.id} AND environment = ${environment}
      `;
    } catch (updateError) {
      // Log but don't fail login if last_login update fails
      console.error('Error updating last_login (non-critical):', updateError);
    }

    return user;
  } catch (error) {
    console.error('Error verifying password:', error);
    return null;
  }
}

// Clean up expired tokens (call this periodically)
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    await sql`DELETE FROM tokens WHERE expires < NOW()`;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
}

// Security: Get user count for admin purposes (no sensitive data)
export async function getUserCount(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM users`;
  return parseInt(result.rows[0].count);
}

// Security: Get confirmed user count
export async function getConfirmedUserCount(): Promise<number> {
  const environment = getCurrentEnvironment();
  const result = await sql`SELECT COUNT(*) as count FROM users WHERE email_confirmed = TRUE AND environment = ${environment}`;
  return parseInt(result.rows[0].count);
}

// Bracket management functions
export interface Bracket {
  id: string;
  userId: string;
  entryName: string;
  tieBreaker?: number;
  picks: Record<string, string>;
  status: string;
  bracketNumber: number;
  year: number;
  environment: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createBracket(userId: string, entryName: string, tieBreaker?: number, picks: Record<string, string> = {}): Promise<Bracket> {
  const environment = getCurrentEnvironment();
  const bracketId = crypto.randomUUID();
  
  // Get year from site config (tournament_year)
  let year = new Date().getFullYear(); // Default fallback
  try {
    const config = await getSiteConfigFromGoogleSheets();
    if (config?.tournamentYear) {
      year = parseInt(config.tournamentYear);
    }
  } catch (error) {
    // Use fallback config if Google Sheets fails
    if (FALLBACK_CONFIG.tournamentYear) {
      year = parseInt(FALLBACK_CONFIG.tournamentYear);
    }
  }
  
  // Get the next bracket number for this year and environment
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

export async function getBracketsByUserId(userId: string): Promise<Bracket[]> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM brackets 
    WHERE user_id = ${userId} AND environment = ${environment}
    ORDER BY created_at DESC
  `;
  
  return result.rows.map((row: Record<string, unknown>) => ({
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
  }));
}

export async function getBracketById(bracketId: string): Promise<Bracket | null> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT * FROM brackets 
    WHERE id = ${bracketId} AND environment = ${environment}
  `;
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    entryName: row.entry_name,
    tieBreaker: row.tie_breaker,
    picks: row.picks,
    status: row.status,
    bracketNumber: row.bracket_number,
    year: row.year,
    environment: row.environment,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function updateBracket(bracketId: string, updates: Partial<Pick<Bracket, 'entryName' | 'tieBreaker' | 'picks' | 'status' | 'userId'>>): Promise<Bracket | null> {
  const environment = getCurrentEnvironment();
  
  // Get the current bracket first
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
  
  // Update the bracket
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
  
  // Return the updated bracket
  return await getBracketById(bracketId);
}

export async function deleteBracket(bracketId: string): Promise<boolean> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    DELETE FROM brackets 
    WHERE id = ${bracketId} AND environment = ${environment}
  `;
  
  return (result.rowCount ?? 0) > 0;
}

// Admin functions
export async function getAllUsers(): Promise<Omit<User, 'password'>[]> {
  const environment = getCurrentEnvironment();
  
  try {
    const result = await sql`
      SELECT id, email, name, email_confirmed, created_at, last_login, environment
      FROM users 
      WHERE environment = ${environment}
      ORDER BY created_at DESC
    `;
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      emailConfirmed: row.email_confirmed as boolean,
      createdAt: new Date(row.created_at as string),
      lastLogin: row.last_login ? new Date(row.last_login as string) : null,
      environment: row.environment as string,
    }));
  } catch (error) {
    // If last_login column doesn't exist yet, try without it
    if (error instanceof Error && error.message.includes('last_login')) {
      console.log('[getAllUsers] last_login column not found, fetching without it');
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
        createdAt: new Date(row.created_at as string),
        lastLogin: null,
        environment: row.environment as string,
      }));
    }
    throw error;
  }
}

export async function getAllBrackets(): Promise<(Bracket & { userEmail: string; userName: string })[]> {
  const environment = getCurrentEnvironment();
  
  const result = await sql`
    SELECT b.*, u.email as user_email, u.name as user_name
    FROM brackets b
    JOIN users u ON b.user_id = u.id
    WHERE b.environment = ${environment} AND u.environment = ${environment}
    ORDER BY b.created_at DESC
  `;
  
  return result.rows.map((row: Record<string, unknown>) => ({
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
    userEmail: row.user_email as string,
    userName: row.user_name as string,
  }));
}

/**
 * Get bracket counts by status for a specific user
 * @param userId - The user ID to get bracket counts for
 * @returns Object with submitted, inProgress, and deleted counts
 */
export async function getUserBracketCounts(userId: string): Promise<{
  submitted: number;
  inProgress: number;
  deleted: number;
}> {
  const environment = getCurrentEnvironment();
  
  // Use SUM with CASE instead of FILTER for better compatibility
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
 * Delete a user and all associated data
 * @param userId - The user ID to delete
 * @returns True if user was deleted, false otherwise
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const environment = getCurrentEnvironment();
  
  try {
    // Check if user has any brackets
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
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}