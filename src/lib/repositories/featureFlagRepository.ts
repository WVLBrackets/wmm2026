import { sql } from '../databaseAdapter';
import { getCurrentEnvironment } from '../databaseConfig';

const MASTER_KILL_SWITCH_KEY = 'master_kill_switch';
let featureFlagsTableEnsured = false;

/**
 * Ensure the feature_flags table exists and is indexed.
 */
async function ensureFeatureFlagsTable(): Promise<void> {
  if (featureFlagsTableEnsured) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS feature_flags (
      key VARCHAR(100) NOT NULL,
      environment VARCHAR(50) NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (key, environment)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_feature_flags_environment ON feature_flags(environment)`;
  featureFlagsTableEnsured = true;
}

/**
 * Ensure the master kill switch row exists with a default ON state.
 */
async function ensureMasterKillSwitchRow(): Promise<void> {
  await ensureFeatureFlagsTable();
  const environment = getCurrentEnvironment();

  await sql`
    INSERT INTO feature_flags (key, environment, is_enabled)
    VALUES (${MASTER_KILL_SWITCH_KEY}, ${environment}, TRUE)
    ON CONFLICT (key, environment) DO NOTHING
  `;
}

/**
 * Get the current master kill switch state for this environment.
 * Returns true by default when no explicit value is stored.
 */
export async function getMasterKillSwitchEnabled(): Promise<boolean> {
  await ensureMasterKillSwitchRow();
  const environment = getCurrentEnvironment();

  const result = await sql`
    SELECT is_enabled
    FROM feature_flags
    WHERE key = ${MASTER_KILL_SWITCH_KEY}
      AND environment = ${environment}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return true;
  }

  return Boolean(result.rows[0].is_enabled);
}

/**
 * Update the master kill switch state for this environment.
 */
export async function setMasterKillSwitchEnabled(enabled: boolean): Promise<boolean> {
  await ensureMasterKillSwitchRow();
  const environment = getCurrentEnvironment();

  await sql`
    UPDATE feature_flags
    SET is_enabled = ${enabled},
        updated_at = ${new Date()}
    WHERE key = ${MASTER_KILL_SWITCH_KEY}
      AND environment = ${environment}
  `;

  return getMasterKillSwitchEnabled();
}
