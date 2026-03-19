/**
 * Database migrations and initialization
 * 
 * Centralizes all database schema creation and migration logic.
 * This module should be the only place where CREATE TABLE and ALTER TABLE statements exist.
 */

import { sql } from '../databaseAdapter';
import { getCurrentEnvironment, getDatabaseConfig } from '../databaseConfig';

/**
 * Initialize all database tables with environment isolation
 * 
 * This function creates all required tables if they don't exist.
 * Safe to call multiple times - uses IF NOT EXISTS.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    getDatabaseConfig();
    getCurrentEnvironment();
    
    // Users table
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

    // Add last_login column for existing databases
    await addLastLoginColumn();
    // Add key/lock columns for live results support
    await addBracketLiveResultsColumns();

    // Tokens table
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

    // Brackets table
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

    // Admin actions audit table
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

    // Usage logs table
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

    // Error logs table
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

    // Email logs table
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

    // Feature flags table (environment-scoped)
    await sql`
      CREATE TABLE IF NOT EXISTS feature_flags (
        key VARCHAR(100) NOT NULL,
        environment VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (key, environment)
      )
    `;

    // Team reference data (shared across environments, uses production DB)
    const { teamDataSql } = await import('../teamDataConnection');
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

    // Create indexes
    await createIndexes();

    // Add environment constraints
    await addEnvironmentConstraints();

  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Initialize team_reference_data table
 * 
 * This is called before team data operations to ensure the table exists
 * with all required columns.
 */
export async function initializeTeamDataTable(): Promise<void> {
  try {
    const { teamDataSql } = await import('../teamDataConnection');
    
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
    
    // Add mascot column if missing
    await addTeamDataColumnIfNotExists('mascot', 'VARCHAR(255)');
    
    // Add active column if missing
    const activeAdded = await addTeamDataColumnIfNotExists('active', 'BOOLEAN DEFAULT false');
    
    if (activeAdded) {
      // Set initial active status based on abbreviation
      await teamDataSql`
        UPDATE team_reference_data 
        SET active = true 
        WHERE key !~ '^[0-9]+$'
      `;
    }
  } catch (error) {
    console.error('[initializeTeamDataTable] Error:', error);
  }
}

/**
 * Add last_login column to users table if it doesn't exist
 */
async function addLastLoginColumn(): Promise<boolean> {
  try {
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
        AND column_name = 'last_login'
        AND table_schema = current_schema()
    `;
    
    if (columnCheck.rows.length === 0) {
      await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMP`;
      return true;
    }
    return false;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('already exists') || 
      error.message.includes('duplicate column')
    )) {
      return false;
    }
    console.error('[addLastLoginColumn] Error:', error);
    return false;
  }
}

/**
 * Add live-results support columns to brackets table if missing.
 */
async function addBracketLiveResultsColumns(): Promise<void> {
  try {
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS is_key BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_user_id VARCHAR(36)`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMP`;

    // Backfill and enforce non-null behavior for existing rows.
    await sql`UPDATE brackets SET is_key = FALSE WHERE is_key IS NULL`;
    await sql`ALTER TABLE brackets ALTER COLUMN is_key SET DEFAULT FALSE`;
    await sql`ALTER TABLE brackets ALTER COLUMN is_key SET NOT NULL`;

    // One KEY bracket per year per environment.
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brackets_one_key_per_year_env
      ON brackets (year, environment)
      WHERE is_key = TRUE
    `;
  } catch (error) {
    console.error('[addBracketLiveResultsColumns] Error:', error);
  }
}

/**
 * Helper to add a column to team_reference_data table
 */
async function addTeamDataColumnIfNotExists(
  column: string, 
  definition: string
): Promise<boolean> {
  try {
    const { teamDataSql } = await import('../teamDataConnection');
    
    const columnCheck = await teamDataSql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'team_reference_data' 
        AND column_name = ${column}
        AND table_schema = current_schema()
    `;
    
    if (columnCheck.rows.length === 0) {
      // Dynamic SQL not supported the same way, use raw query
      if (column === 'mascot') {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN mascot VARCHAR(255)`;
      } else if (column === 'active') {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN active BOOLEAN DEFAULT false`;
      }
      return true;
    }
    return false;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('already exists') || 
      error.message.includes('duplicate column')
    )) {
      return false;
    }
    console.error(`[addTeamDataColumnIfNotExists] Error adding ${column}:`, error);
    return false;
  }
}

/**
 * Create all database indexes
 */
async function createIndexes(): Promise<void> {
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
  await sql`CREATE INDEX IF NOT EXISTS idx_feature_flags_environment ON feature_flags(environment)`;
}

/**
 * Add environment check constraints
 */
async function addEnvironmentConstraints(): Promise<void> {
  try {
    await sql`
      ALTER TABLE users ADD CONSTRAINT chk_users_environment 
      CHECK (environment IN ('development', 'preview', 'production'))
    `;
  } catch {
    // Constraint might already exist
  }
  
  try {
    await sql`
      ALTER TABLE brackets ADD CONSTRAINT chk_brackets_environment 
      CHECK (environment IN ('development', 'preview', 'production'))
    `;
  } catch {
    // Constraint might already exist
  }
}
