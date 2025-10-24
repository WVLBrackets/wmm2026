export interface DatabaseConfig {
  connectionString: string;
  environment: string;
  database: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  
  // Determine current environment
  let environment: string;
  let connectionString: string;
  let database: string;
  
  if (nodeEnv === 'development') {
    // Local development
    environment = 'development';
    connectionString = process.env.DATABASE_URL_LOCAL || 'postgresql://localhost:5432/wmm2026_dev';
    database = 'wmm2026_dev';
    
    // Set the environment variable that @vercel/postgres expects
    if (connectionString && !process.env.POSTGRES_URL) {
      process.env.POSTGRES_URL = connectionString;
    }
  } else if (vercelEnv === 'preview') {
    // Vercel preview/staging
    environment = 'preview';
    connectionString = process.env.DATABASE_URL_PREVIEW || '';
    database = `wmm2026_preview_${process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'}`;
  } else {
    // Production
    environment = 'production';
    connectionString = process.env.DATABASE_URL_PROD || '';
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

export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

export function isPreview(): boolean {
  return getCurrentEnvironment() === 'preview';
}
