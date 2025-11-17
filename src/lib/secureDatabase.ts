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
        WHERE table_name = 'users' 
          AND column_name = 'last_login'
          AND table_schema = current_schema()
      `;
      
      if (columnCheck.rows.length === 0) {
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`;
      }
    } catch (error) {
      // If IF NOT EXISTS is not supported, try without it
      if (error instanceof Error && error.message.includes('IF NOT EXISTS')) {
        try {
          await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP`;
        } catch (addError) {
          // Column might already exist
          if (!(addError instanceof Error && (
            addError.message.includes('already exists') || 
            addError.message.includes('duplicate column')
          ))) {
            console.error('[initializeDatabase] Error adding last_login column:', addError);
          }
        }
      } else {
        console.error('[initializeDatabase] Error checking/adding last_login column:', error);
      }
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

    // Create usage logs table for tracking user interactions
    await sql`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_logged_in BOOLEAN NOT NULL,
        username VARCHAR(255),
        event_type VARCHAR(20) NOT NULL,
        location VARCHAR(255) NOT NULL,
        bracket_id VARCHAR(36),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create error logs table for tracking application errors
    await sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_logged_in BOOLEAN NOT NULL,
        username VARCHAR(255),
        error_message TEXT NOT NULL,
        error_stack TEXT,
        error_type VARCHAR(100),
        location VARCHAR(255),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create email logs table for tracking email events
    await sql`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        event_type VARCHAR(50) NOT NULL,
        destination_email VARCHAR(255) NOT NULL,
        attachment_expected BOOLEAN NOT NULL,
        attachment_success BOOLEAN,
        email_success BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create team_reference_data table for managing team data
    // Note: This table is created in PROD database and accessed by both staging and prod
    // No environment column needed since all environments share the same data
    const { teamDataSql } = await import('./teamDataConnection');
    await teamDataSql`
      CREATE TABLE IF NOT EXISTS team_reference_data (
        key VARCHAR(50) PRIMARY KEY,
        id VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        mascot VARCHAR(255),
        logo VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await teamDataSql`CREATE INDEX IF NOT EXISTS idx_team_ref_id ON team_reference_data(id)`;

    // Create environment-specific indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email_env ON users(email, environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_environment ON users(environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_user_id_env ON tokens(user_id, environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_brackets_user_id_env ON brackets(user_id, environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_brackets_environment ON brackets(environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_environment ON usage_logs(environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_username ON usage_logs(username)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_environment ON error_logs(environment)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_username ON error_logs(username)`;

    // Add environment constraints (PostgreSQL doesn't support IF NOT EXISTS with ADD CONSTRAINT)
    try {
      await sql`
        ALTER TABLE users ADD CONSTRAINT chk_users_environment 
        CHECK (environment IN ('development', 'preview', 'production'))
      `;
    } catch (error) {
      // Constraint might already exist, ignore the error
    }
    
    try {
      await sql`
        ALTER TABLE brackets ADD CONSTRAINT chk_brackets_environment 
        CHECK (environment IN ('development', 'preview', 'production'))
      `;
    } catch (error) {
      // Constraint might already exist, ignore the error
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const environment = getCurrentEnvironment();
  
  // Auto-initialize database if tables don't exist
  try {
    // Try a simple query to check if users table exists
    await sql`SELECT 1 FROM users LIMIT 1`;
  } catch (error) {
    // If table doesn't exist, initialize the database
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
      // Re-throw if it's a different error
      throw error;
    }
  }
  
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
  
  const userId = crypto.randomUUID();
  
  // Insert user with environment (always require email confirmation)
  await sql`
    INSERT INTO users (
      id, email, name, password, email_confirmed,
      confirmation_token, confirmation_expires, environment
    ) VALUES (
      ${userId}, ${email}, ${name}, ${hashedPassword}, false,
      ${confirmationToken}, 
      ${confirmationExpires.toISOString()},
      ${environment}
    )
  `;
  
  // Always store confirmation token
  await sql`
    INSERT INTO tokens (token, user_id, expires, type, environment)
    VALUES (${confirmationToken}, ${userId}, ${confirmationExpires.toISOString()}, 'confirmation', ${environment})
  `;

  return {
    id: userId,
    email,
    name,
    password: hashedPassword,
    emailConfirmed: false,
    confirmationToken,
    confirmationExpires,
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

export async function confirmUserEmail(token: string): Promise<{ success: boolean; userEmail?: string; signInToken?: string }> {
  try {
    const environment = getCurrentEnvironment();
    
    // Find token in current environment
    const tokenResult = await sql`
      SELECT * FROM tokens 
      WHERE token = ${token} AND type = 'confirmation' AND expires > NOW() AND environment = ${environment}
    `;
    
    if (tokenResult.rows.length === 0) {
      return { success: false };
    }
    
    const tokenRow = tokenResult.rows[0];
    
    // Get user email before updating
    const userResult = await sql`
      SELECT email FROM users WHERE id = ${tokenRow.user_id}
    `;
    
    if (userResult.rows.length === 0) {
      return { success: false };
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Update user to confirmed
    await sql`
      UPDATE users 
      SET email_confirmed = TRUE, confirmation_token = NULL, confirmation_expires = NULL
      WHERE id = ${tokenRow.user_id}
    `;
    
    // Create a temporary sign-in token (expires in 5 minutes)
    const signInToken = crypto.randomUUID();
    const signInExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    await sql`
      INSERT INTO tokens (token, user_id, expires, type, environment)
      VALUES (${signInToken}, ${tokenRow.user_id}, ${signInExpires}, 'auto_signin', ${environment})
    `;
    
    // Remove confirmation token
    await sql`
      DELETE FROM tokens WHERE token = ${token}
    `;
    
    return { success: true, userEmail, signInToken };
  } catch (error) {
    console.error('Error confirming user email:', error);
    return { success: false };
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

export async function verifyPassword(email: string, password: string): Promise<{ user: User | null; error?: 'not_confirmed' | 'invalid' }> {
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return { user: null, error: 'invalid' };
    }

    if (!user.emailConfirmed) {
      // Check password first to avoid revealing if email exists
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        return { user: null, error: 'not_confirmed' };
      }
      // If password is wrong, return invalid (don't reveal email exists but not confirmed)
      return { user: null, error: 'invalid' };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return { user: null, error: 'invalid' };
    }

    // Update last_login timestamp on successful login
    // This is a non-critical update, so we don't fail login if it errors
    try {
      const environment = getCurrentEnvironment();
      console.log(`[verifyPassword] Updating last_login for user ${user.id} in environment ${environment}`);
      
      // First check if column exists, create it if needed
      try {
        const columnCheck = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
            AND column_name = 'last_login'
            AND table_schema = current_schema()
        `;
        
        if (columnCheck.rows.length === 0) {
          try {
            await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP`;
          } catch (addError) {
            // Column might have been created by another request, try the update anyway
            if (addError instanceof Error && (
              !addError.message.includes('already exists') && 
              !addError.message.includes('duplicate column')
            )) {
              console.error('[verifyPassword] Error creating last_login column:', addError);
              throw addError;
            }
          }
        }
      } catch (checkError) {
        console.error('[verifyPassword] Error checking for last_login column:', checkError);
        // Continue anyway, try the update - might work if column exists
      }
      
      // Now try the update
      await sql`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = ${user.id} AND environment = ${environment}
      `;
    } catch (updateError) {
      // Log but don't fail login if last_login update fails
      console.error('[verifyPassword] Error updating last_login (non-critical):', updateError);
    }

    return { user };
  } catch (error) {
    console.error('Error verifying password:', error);
    return { user: null, error: 'invalid' };
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
  } catch {
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
    
    const users = result.rows.map((row: Record<string, unknown>) => {
      const lastLoginValue = row.last_login;
      return {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        emailConfirmed: row.email_confirmed as boolean,
        createdAt: new Date(row.created_at as string),
        lastLogin: lastLoginValue ? new Date(lastLoginValue as string) : null,
        environment: row.environment as string,
      };
    });
    return users;
  } catch (error) {
    // If last_login column doesn't exist yet, try without it
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

/**
 * Get all team reference data from database
 * Uses production database connection (shared between staging and prod)
 * @param activeOnly - If true, only returns active teams
 */
export async function getAllTeamReferenceData(activeOnly: boolean = false): Promise<Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>> {
  try {
    const { teamDataSql } = await import('./teamDataConnection');
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
    
    const teams: Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }> = {};
    for (const row of result.rows) {
      // Convert database boolean/null to JavaScript boolean
      // PostgreSQL returns null as a JavaScript null, but we need to handle it explicitly
      // If active is null in DB, treat as false (inactive)
      // If active is explicitly false in DB, preserve that
      // If active is true in DB, preserve that
      let activeBoolean: boolean;
      if (row.active === null || row.active === undefined) {
        activeBoolean = false;
      } else {
        // PostgreSQL booleans come as true/false, but ensure it's a proper boolean
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
    // If table doesn't exist, return empty object
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
 * Update team reference data (replace all teams)
 * Uses production database connection (shared between staging and prod)
 */
export async function updateTeamReferenceData(teams: Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>): Promise<void> {
  try {
    const { teamDataSql } = await import('./teamDataConnection');
    
    // Delete all existing teams (no environment filter needed)
    await teamDataSql`
      DELETE FROM team_reference_data
    `;
    
    // Insert all teams
    const entries = Object.entries(teams);
    if (entries.length > 0) {
      for (const [key, team] of entries) {
        // Determine active status: if not specified, use non-numerical abbreviation logic
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
 */
export async function updateTeamActiveStatus(key: string, active: boolean): Promise<void> {
  try {
    const { teamDataSql } = await import('./teamDataConnection');
    
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
 * Delete a team from team reference data by key
 * Uses production database connection (shared between staging and prod)
 */
export async function deleteTeamReferenceData(key: string): Promise<void> {
  try {
    const { teamDataSql } = await import('./teamDataConnection');
    
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
 * Initialize team_reference_data table in production database
 * This is called before any team data operations
 */
export async function initializeTeamDataTable(): Promise<void> {
  try {
    const { teamDataSql } = await import('./teamDataConnection');
    await teamDataSql`
      CREATE TABLE IF NOT EXISTS team_reference_data (
        key VARCHAR(50) PRIMARY KEY,
        id VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        mascot VARCHAR(255),
        logo VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await teamDataSql`CREATE INDEX IF NOT EXISTS idx_team_ref_id ON team_reference_data(id)`;
    
    // Add mascot column if it doesn't exist (safe migration for existing databases)
    try {
      const columnCheck = await teamDataSql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'team_reference_data' 
          AND column_name = 'mascot'
          AND table_schema = current_schema()
      `;
      
      if (columnCheck.rows.length === 0) {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN mascot VARCHAR(255)`;
      }
    } catch (mascotError) {
      // Column might already exist or there's an issue, but don't fail initialization
      if (!(mascotError instanceof Error && (
        mascotError.message.includes('already exists') || 
        mascotError.message.includes('duplicate column')
      ))) {
        console.error('[initializeTeamDataTable] Error checking/adding mascot column:', mascotError);
      }
    }

    // Add active column if it doesn't exist (safe migration for existing databases)
    try {
      const activeColumnCheck = await teamDataSql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'team_reference_data' 
          AND column_name = 'active'
          AND table_schema = current_schema()
      `;
      
      if (activeColumnCheck.rows.length === 0) {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN active BOOLEAN DEFAULT false`;
        
        // Set initial active status based on abbreviation (non-numerical = active)
        await teamDataSql`
          UPDATE team_reference_data 
          SET active = true 
          WHERE key !~ '^[0-9]+$'
        `;
      }
    } catch (activeError) {
      // Column might already exist or there's an issue, but don't fail initialization
      if (!(activeError instanceof Error && (
        activeError.message.includes('already exists') || 
        activeError.message.includes('duplicate column')
      ))) {
        console.error('[initializeTeamDataTable] Error checking/adding active column:', activeError);
      }
    }
    
    // Team reference data table initialized (no logging to reduce noise)
  } catch (error) {
    console.error('[initializeTeamDataTable] Error initializing team data table:', error);
    // Don't throw - allow function to continue even if table creation fails
    // (might already exist)
  }
}

/**
 * Sync team data from JSON file to database
 * DEPRECATED: Database is now the single source of truth.
 * This function is kept for backwards compatibility but does nothing.
 * Team data should be managed through the Admin Panel.
 */
export async function syncTeamDataFromJSON(): Promise<void> {
  // Database is the source of truth - no longer syncing from JSON file
  // This function is a no-op to maintain backwards compatibility
  return;
}