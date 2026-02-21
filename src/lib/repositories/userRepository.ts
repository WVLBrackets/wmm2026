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
import type { User, BracketCounts } from '../types/database';

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
      ${userId}, ${email}, ${name}, ${hashedPassword}, false,
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
    name,
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
        createdAt: new Date(row.created_at as string),
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
        createdAt: new Date(row.created_at as string),
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
        await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP`;
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
      SET last_login = CURRENT_TIMESTAMP
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
 * Map database row to User type
 */
function mapRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    password: row.password as string,
    emailConfirmed: row.email_confirmed as boolean,
    confirmationToken: row.confirmation_token as string | undefined,
    confirmationExpires: row.confirmation_expires 
      ? new Date(row.confirmation_expires as string) 
      : undefined,
    resetToken: row.reset_token as string | undefined,
    resetExpires: row.reset_expires 
      ? new Date(row.reset_expires as string) 
      : undefined,
    environment: row.environment as string,
    createdAt: new Date(row.created_at as string),
    lastLogin: row.last_login 
      ? new Date(row.last_login as string) 
      : undefined,
  };
}
