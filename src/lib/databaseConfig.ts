import { AppEnvironment, getAppEnvironment } from './appEnvironment';

export interface DatabaseConfig {
  connectionString: string;
  environment: string;
  database: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const appEnv: AppEnvironment = getAppEnvironment();
  
  // Determine current environment (local, preview, or production)
  let environment: AppEnvironment;
  let connectionString: string;
  let database: string;
  
  if (appEnv === 'local') {
    // Local-only cloned database (safe: no staging/prod writes)
    environment = 'local';
    connectionString = process.env.LOCAL_POSTGRES_URL || process.env.POSTGRES_URL_LOCAL || '';
    database = 'wmm2026_local';
  } else if (appEnv === 'preview') {
    // Vercel preview/staging
    environment = 'preview';
    connectionString = process.env.PREVIEW_POSTGRES_URL || process.env.POSTGRES_URL || '';
    database = `wmm2026_preview_${process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'}`;
  } else {
    // Production
    environment = 'production';
    connectionString = process.env.PRODUCTION_POSTGRES_URL || process.env.POSTGRES_URL || '';
    database = 'wmm2026_prod';
  }
  
  if (!connectionString) {
    if (environment === 'local') {
      throw new Error('Local database connection is not configured. Set LOCAL_POSTGRES_URL (or POSTGRES_URL_LOCAL).');
    }
    throw new Error(`Database connection string not configured for environment: ${environment}`);
  }
  
  return {
    connectionString,
    environment,
    database
  };
}

export function getCurrentEnvironment(): string {
  return getDatabaseConfig().environment;
}

/**
 * Append `options=-c TimeZone=UTC` so every Postgres session treats timestamps consistently
 * (`timestamptz`, `now()`, `CURRENT_TIMESTAMP` align with UTC).
 */
export function withPostgresSessionTimezoneUtc(connectionString: string): string {
  if (!connectionString) {
    return connectionString;
  }
  const lower = connectionString.toLowerCase();
  if (lower.includes('timezone=utc') || lower.includes('time%20zone%3dutc')) {
    return connectionString;
  }
  const sep = connectionString.includes('?') ? '&' : '?';
  return `${connectionString}${sep}options=-c%20TimeZone%3DUTC`;
}

export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

export function isPreview(): boolean {
  return getCurrentEnvironment() === 'preview';
}

export function isLocal(): boolean {
  return getCurrentEnvironment() === 'local';
}
