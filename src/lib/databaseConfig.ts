export interface DatabaseConfig {
  connectionString: string;
  environment: string;
  database: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const vercelEnv = process.env.VERCEL_ENV;
  
  // Determine current environment (preview or production)
  let environment: string;
  let connectionString: string;
  let database: string;
  
  if (vercelEnv === 'preview') {
    // Vercel preview/staging
    environment = 'preview';
    connectionString = process.env.POSTGRES_URL || '';
    database = `wmm2026_preview_${process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'}`;
  } else {
    // Production (default)
    environment = 'production';
    connectionString = process.env.POSTGRES_URL || '';
    database = 'wmm2026_prod';
  }
  
  if (!connectionString) {
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

export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

export function isPreview(): boolean {
  return getCurrentEnvironment() === 'preview';
}
