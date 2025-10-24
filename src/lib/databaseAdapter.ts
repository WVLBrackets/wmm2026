import { getCurrentEnvironment } from './databaseConfig';

// Environment-aware database adapter
// Uses @vercel/postgres for production/preview (Neon)
// Uses pg for local development (local PostgreSQL)

let sqlAdapter: any = null;

async function getSqlAdapter() {
  if (!sqlAdapter) {
    const environment = getCurrentEnvironment();
    
    if (environment === 'development') {
      // Use local PostgreSQL for development
      const { sql } = await import('./localPostgres');
      sqlAdapter = sql;
    } else {
      // Use Vercel Postgres for production/preview (Neon)
      const { sql } = await import('@vercel/postgres');
      sqlAdapter = sql;
    }
  }
  return sqlAdapter;
}

// Export the environment-aware SQL function
export const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  const sqlAdapter = await getSqlAdapter();
  return sqlAdapter(strings, ...values);
};

// Export environment info for debugging
export function getDatabaseInfo() {
  const environment = getCurrentEnvironment();
  return {
    environment,
    driver: environment === 'development' ? 'pg (local)' : '@vercel/postgres (Neon)',
    connectionString: environment === 'development' 
      ? process.env.DATABASE_URL_LOCAL?.substring(0, 50) + '...'
      : 'Neon connection string'
  };
}
