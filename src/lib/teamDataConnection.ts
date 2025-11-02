import { getCurrentEnvironment } from './databaseConfig';
import type { QueryResult, Pool } from 'pg';

/**
 * SQL function type for team data operations
 */
type SqlFunction = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<QueryResult>;

let teamDataSqlAdapter: SqlFunction | null = null;
let teamDataPool: Pool | null = null;

/**
 * Get SQL adapter for team reference data
 * - Development: uses local database (DATABASE_URL_LOCAL)
 * - Staging/Preview: uses production database (POSTGRES_URL_PROD)
 * - Production: uses production database (POSTGRES_URL or POSTGRES_URL_PROD)
 */
async function getTeamDataSqlAdapter(): Promise<SqlFunction> {
  if (!teamDataSqlAdapter) {
    const environment = getCurrentEnvironment();
    
    if (environment === 'development') {
      // Development: use local database
      const { sql } = await import('./localPostgres');
      teamDataSqlAdapter = sql as SqlFunction;
    } else {
      // Staging and Production: use production database connection
      // In staging, POSTGRES_URL_PROD points to prod DB
      // In production, POSTGRES_URL_PROD should equal POSTGRES_URL (or we use POSTGRES_URL)
      const postgresUrl = process.env.POSTGRES_URL_PROD || process.env.POSTGRES_URL;
      
      if (!postgresUrl) {
        throw new Error('POSTGRES_URL_PROD or POSTGRES_URL environment variable is not set for team data');
      }
      
      // Use pg Pool for cross-environment connection (works for Neon/Vercel Postgres)
      const { Pool } = await import('pg');
      teamDataPool = new Pool({
        connectionString: postgresUrl,
        ssl: { rejectUnauthorized: false }, // Required for Neon/Vercel Postgres
        max: 5, // Limit connection pool size
      });
      
      // Create SQL function that uses parameterized queries
      teamDataSqlAdapter = async (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (!teamDataPool) {
          throw new Error('Team data pool not initialized');
        }
        
        // Build query with parameterized placeholders ($1, $2, etc.)
        let query = strings[0];
        for (let i = 0; i < values.length; i++) {
          query += `$${i + 1}` + strings[i + 1];
        }
        
        return teamDataPool.query(query, values);
      };
    }
  }
  
  return teamDataSqlAdapter;
}

/**
 * SQL function for team reference data operations
 * Always uses production database connection in staging/prod
 */
export const teamDataSql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const sqlAdapter = await getTeamDataSqlAdapter();
  return sqlAdapter(strings, ...values);
};

