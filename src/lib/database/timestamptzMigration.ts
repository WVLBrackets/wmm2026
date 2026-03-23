/**
 * One-time (idempotent) migration: `timestamp without time zone` → `timestamptz`,
 * interpreting existing naive values as UTC wall time (`AT TIME ZONE 'UTC'`).
 *
 * Run with DB session TimeZone=UTC (see {@link withPostgresSessionTimezoneUtc} on the connection string).
 */

import { sql } from '../databaseAdapter';

/** Postgres `information_schema` type for legacy columns we convert. */
const TS_WITHOUT_TZ = 'timestamp without time zone';

async function columnIsTimestampWithoutTz(table: string, column: string): Promise<boolean> {
  const r = await sql`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
  `;
  if (r.rows.length === 0) return false;
  return (r.rows[0] as { data_type: string }).data_type === TS_WITHOUT_TZ;
}

async function tryAlter(run: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.warn(`[timestamptz migration] ${label}:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Migrate main app schema (`sql` / `public`) timestamp columns to `timestamptz`.
 */
export async function migrateAppTablesToTimestamptzUtc(): Promise<void> {
  if (await columnIsTimestampWithoutTz('users', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'users.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now()`,
      'users.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('users', 'last_login')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE users ALTER COLUMN last_login TYPE TIMESTAMPTZ USING last_login AT TIME ZONE 'UTC'`,
      'users.last_login'
    );
  }
  if (await columnIsTimestampWithoutTz('users', 'confirmation_expires')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE users ALTER COLUMN confirmation_expires TYPE TIMESTAMPTZ USING confirmation_expires AT TIME ZONE 'UTC'`,
      'users.confirmation_expires'
    );
  }
  if (await columnIsTimestampWithoutTz('users', 'reset_expires')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE users ALTER COLUMN reset_expires TYPE TIMESTAMPTZ USING reset_expires AT TIME ZONE 'UTC'`,
      'users.reset_expires'
    );
  }
  if (await columnIsTimestampWithoutTz('tokens', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'tokens.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE tokens ALTER COLUMN created_at SET DEFAULT now()`,
      'tokens.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('tokens', 'expires')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE tokens ALTER COLUMN expires TYPE TIMESTAMPTZ USING expires AT TIME ZONE 'UTC'`,
      'tokens.expires'
    );
  }
  if (await columnIsTimestampWithoutTz('brackets', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE brackets ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'brackets.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE brackets ALTER COLUMN created_at SET DEFAULT now()`,
      'brackets.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('brackets', 'updated_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE brackets ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
      'brackets.updated_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE brackets ALTER COLUMN updated_at SET DEFAULT now()`,
      'brackets.updated_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('brackets', 'submitted_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE brackets ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE 'UTC'`,
      'brackets.submitted_at'
    );
  }
  if (await columnIsTimestampWithoutTz('brackets', 'lock_acquired_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE brackets ALTER COLUMN lock_acquired_at TYPE TIMESTAMPTZ USING lock_acquired_at AT TIME ZONE 'UTC'`,
      'brackets.lock_acquired_at'
    );
  }
  if (await columnIsTimestampWithoutTz('admin_actions', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE admin_actions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'admin_actions.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE admin_actions ALTER COLUMN created_at SET DEFAULT now()`,
      'admin_actions.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('usage_logs', 'timestamp')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE usage_logs ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'UTC'`,
      'usage_logs.timestamp'
    );
    await tryAlter(
      () => sql`ALTER TABLE usage_logs ALTER COLUMN timestamp SET DEFAULT now()`,
      'usage_logs.timestamp default'
    );
  }
  if (await columnIsTimestampWithoutTz('usage_logs', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE usage_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'usage_logs.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE usage_logs ALTER COLUMN created_at SET DEFAULT now()`,
      'usage_logs.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('error_logs', 'timestamp')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE error_logs ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'UTC'`,
      'error_logs.timestamp'
    );
    await tryAlter(
      () => sql`ALTER TABLE error_logs ALTER COLUMN timestamp SET DEFAULT now()`,
      'error_logs.timestamp default'
    );
  }
  if (await columnIsTimestampWithoutTz('error_logs', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE error_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'error_logs.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE error_logs ALTER COLUMN created_at SET DEFAULT now()`,
      'error_logs.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('email_logs', 'timestamp')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE email_logs ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'UTC'`,
      'email_logs.timestamp'
    );
    await tryAlter(
      () => sql`ALTER TABLE email_logs ALTER COLUMN timestamp SET DEFAULT now()`,
      'email_logs.timestamp default'
    );
  }
  if (await columnIsTimestampWithoutTz('email_logs', 'created_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE email_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'email_logs.created_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE email_logs ALTER COLUMN created_at SET DEFAULT now()`,
      'email_logs.created_at default'
    );
  }
  if (await columnIsTimestampWithoutTz('feature_flags', 'updated_at')) {
    await tryAlter(
      () =>
        sql`ALTER TABLE feature_flags ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
      'feature_flags.updated_at'
    );
    await tryAlter(
      () => sql`ALTER TABLE feature_flags ALTER COLUMN updated_at SET DEFAULT now()`,
      'feature_flags.updated_at default'
    );
  }
}

async function teamColumnIsTimestampWithoutTz(column: string): Promise<boolean> {
  const { teamDataSql } = await import('../teamDataConnection');
  const r = await teamDataSql`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_reference_data'
      AND column_name = ${column}
  `;
  if (r.rows.length === 0) return false;
  return (r.rows[0] as { data_type: string }).data_type === TS_WITHOUT_TZ;
}

async function teamTryAlter(run: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.warn(`[timestamptz migration team] ${label}:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Migrate `team_reference_data` timestamps on the team-data connection.
 */
export async function migrateTeamReferenceDataToTimestamptzUtc(): Promise<void> {
  if (await teamColumnIsTimestampWithoutTz('created_at')) {
    const { teamDataSql } = await import('../teamDataConnection');
    await teamTryAlter(
      () =>
        teamDataSql`ALTER TABLE team_reference_data ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'`,
      'created_at'
    );
    await teamTryAlter(
      () => teamDataSql`ALTER TABLE team_reference_data ALTER COLUMN created_at SET DEFAULT now()`,
      'created_at default'
    );
  }
  if (await teamColumnIsTimestampWithoutTz('updated_at')) {
    const { teamDataSql } = await import('../teamDataConnection');
    await teamTryAlter(
      () =>
        teamDataSql`ALTER TABLE team_reference_data ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'`,
      'updated_at'
    );
    await teamTryAlter(
      () => teamDataSql`ALTER TABLE team_reference_data ALTER COLUMN updated_at SET DEFAULT now()`,
      'updated_at default'
    );
  }
}
