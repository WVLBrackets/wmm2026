/**
 * Database migrations and initialization
 * 
 * Centralizes all database schema creation and migration logic.
 * This module should be the only place where CREATE TABLE and ALTER TABLE statements exist.
 */

import { sql } from '../databaseAdapter';
import { getCurrentEnvironment, getDatabaseConfig } from '../databaseConfig';
import {
  migrateAppTablesToTimestamptzUtc,
  migrateTeamReferenceDataToTimestamptzUtc,
} from './timestamptzMigration';

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
        confirmation_expires TIMESTAMPTZ,
        reset_token VARCHAR(64),
        reset_expires TIMESTAMPTZ,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        last_login TIMESTAMPTZ,
        UNIQUE(email, environment)
      )
    `;

    // Add last_login column for existing databases
    await addLastLoginColumn();
    await addStandingsViewPreferenceColumn();
    await addLiveStandingsWarningAcknowledgedColumn();
    // Add key/lock columns for live results support
    await addBracketLiveResultsColumns();
    // Add submitted-entry uniqueness constraint for data integrity
    await addSubmittedEntryNameUniqueIndex();

    // Tokens table
    await sql`
      CREATE TABLE IF NOT EXISTS tokens (
        token VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        type VARCHAR(20) NOT NULL,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
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
        source VARCHAR(50) NOT NULL DEFAULT 'site',
        bracket_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        environment VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        submitted_at TIMESTAMPTZ,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(bracket_number, year, environment)
      )
    `;

    await addBracketSubmittedAtColumn();

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
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Usage logs table
    await sql`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT now(),
        is_logged_in BOOLEAN NOT NULL,
        username VARCHAR(255),
        event_type VARCHAR(20) NOT NULL,
        location VARCHAR(255) NOT NULL,
        bracket_id VARCHAR(36),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Error logs table
    await sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT now(),
        is_logged_in BOOLEAN NOT NULL,
        username VARCHAR(255),
        error_message TEXT NOT NULL,
        error_stack TEXT,
        error_type VARCHAR(100),
        location VARCHAR(255),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Email logs table
    await sql`
      CREATE TABLE IF NOT EXISTS email_logs (
        id VARCHAR(36) PRIMARY KEY,
        environment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT now(),
        event_type VARCHAR(50) NOT NULL,
        destination_email VARCHAR(255) NOT NULL,
        attachment_expected BOOLEAN NOT NULL,
        attachment_success BOOLEAN,
        email_success BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Feature flags table (environment-scoped)
    await sql`
      CREATE TABLE IF NOT EXISTS feature_flags (
        key VARCHAR(100) NOT NULL,
        environment VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (key, environment)
      )
    `;

    // Cached live standings (recomputed when KEY bracket is saved)
    await sql`
      CREATE TABLE IF NOT EXISTS live_standings_snapshots (
        environment VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        key_bracket_id VARCHAR(36) NOT NULL,
        key_updated_at TIMESTAMPTZ NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        entries JSONB NOT NULL,
        PRIMARY KEY (environment, year)
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
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    
    await teamDataSql`CREATE INDEX IF NOT EXISTS idx_team_ref_id ON team_reference_data(id)`;

    // Create indexes
    await createIndexes();

    // Add environment constraints
    await addEnvironmentConstraints();

    await migrateAppTablesToTimestamptzUtc();

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
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
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

    // Short label for UI; official school name remains in `name`
    await addTeamDataColumnIfNotExists('display_name', 'VARCHAR(255)');
    await teamDataSql`
      UPDATE team_reference_data
      SET display_name = name
      WHERE display_name IS NULL OR TRIM(COALESCE(display_name, '')) = ''
    `;

    await migrateTeamReferenceDataToTimestamptzUtc();
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
      await sql`ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ`;
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
 * Persisted choice for `/standings`: `daily` (sheet standings) vs `live` (placeholder until live data exists).
 * Scoped by user + environment; nullable means default daily.
 */
async function addStandingsViewPreferenceColumn(): Promise<void> {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS standings_view_preference VARCHAR(20)`;
  } catch (error) {
    console.error('[addStandingsViewPreferenceColumn] Error:', error);
  }
}

/**
 * When true, user has accepted the Live Standings disclaimer (button 1); gate is skipped until reset logic changes.
 */
async function addLiveStandingsWarningAcknowledgedColumn(): Promise<void> {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS live_standings_warning_acknowledged BOOLEAN DEFAULT FALSE`;
  } catch (error) {
    console.error('[addLiveStandingsWarningAcknowledgedColumn] Error:', error);
  }
}

/**
 * Add live-results support columns to brackets table if missing.
 */
async function addBracketLiveResultsColumns(): Promise<void> {
  try {
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS is_key BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_user_id VARCHAR(36)`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ`;
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS source VARCHAR(50)`;

    // Backfill and enforce non-null behavior for existing rows.
    await sql`UPDATE brackets SET is_key = FALSE WHERE is_key IS NULL`;
    await sql`UPDATE brackets SET source = 'site' WHERE source IS NULL OR source = ''`;
    await sql`ALTER TABLE brackets ALTER COLUMN is_key SET DEFAULT FALSE`;
    await sql`ALTER TABLE brackets ALTER COLUMN is_key SET NOT NULL`;
    await sql`ALTER TABLE brackets ALTER COLUMN source SET DEFAULT 'site'`;
    await sql`ALTER TABLE brackets ALTER COLUMN source SET NOT NULL`;

    // One KEY bracket per year per environment.
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
  } catch (error) {
    console.error('[addBracketLiveResultsColumns] Error:', error);
  }
}

/**
 * Ensure `submitted_at` exists on brackets (legacy DBs) and backfill from `updated_at` where needed.
 */
async function addBracketSubmittedAtColumn(): Promise<void> {
  try {
    await sql`ALTER TABLE brackets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`;
    await sql`
      UPDATE brackets
      SET submitted_at = updated_at
      WHERE status = 'submitted' AND submitted_at IS NULL
    `;
  } catch (error) {
    console.error('[addBracketSubmittedAtColumn] Error:', error);
  }
}

/**
 * Ensure submitted brackets cannot duplicate entry names for the same user/year/environment.
 * This complements API-level validation with DB-level integrity.
 */
async function addSubmittedEntryNameUniqueIndex(): Promise<void> {
  try {
    const duplicates = await sql`
      SELECT user_id, year, environment, LOWER(entry_name) AS normalized_entry_name, COUNT(*) AS duplicate_count
      FROM brackets
      WHERE status = 'submitted' AND COALESCE(is_key, FALSE) = FALSE
      GROUP BY user_id, year, environment, LOWER(entry_name)
      HAVING COUNT(*) > 1
      LIMIT 1
    `;

    if (duplicates.rows.length > 0) {
      console.error(
        '[addSubmittedEntryNameUniqueIndex] Duplicate submitted entry names detected; index not created.'
      );
      return;
    }

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brackets_submitted_unique_entry_name_per_user_year_env
      ON brackets (user_id, year, environment, LOWER(entry_name))
      WHERE status = 'submitted' AND COALESCE(is_key, FALSE) = FALSE
    `;
  } catch (error) {
    console.error('[addSubmittedEntryNameUniqueIndex] Error:', error);
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
      if (column === 'mascot') {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN mascot VARCHAR(255)`;
      } else if (column === 'active') {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN active BOOLEAN DEFAULT false`;
      } else if (column === 'display_name') {
        await teamDataSql`ALTER TABLE team_reference_data ADD COLUMN display_name VARCHAR(255)`;
      } else {
        console.warn(`[addTeamDataColumnIfNotExists] Unknown column: ${column}`);
        return false;
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
    await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_environment`;
    await sql`
      ALTER TABLE users ADD CONSTRAINT chk_users_environment 
      CHECK (environment IN ('development', 'local', 'preview', 'production'))
    `;
  } catch (error) {
    console.error('[addEnvironmentConstraints] users constraint update failed:', error);
  }
  
  try {
    await sql`ALTER TABLE brackets DROP CONSTRAINT IF EXISTS chk_brackets_environment`;
    await sql`
      ALTER TABLE brackets ADD CONSTRAINT chk_brackets_environment 
      CHECK (environment IN ('development', 'local', 'preview', 'production'))
    `;
  } catch (error) {
    console.error('[addEnvironmentConstraints] brackets constraint update failed:', error);
  }
}
