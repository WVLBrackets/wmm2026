import type { QueryResult } from 'pg';

// Database adapter - always uses @vercel/postgres (Neon)

type SqlFunction = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<QueryResult>;

let sqlAdapter: SqlFunction | null = null;

async function getSqlAdapter(): Promise<SqlFunction> {
  if (!sqlAdapter) {
    // Always use Vercel Postgres (Neon)
    const { sql } = await import('@vercel/postgres');
    sqlAdapter = sql as SqlFunction;
  }
  return sqlAdapter;
}

// Export the SQL function
export const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const sqlAdapter = await getSqlAdapter();
  return sqlAdapter(strings, ...values);
};

// Export environment info for debugging
export function getDatabaseInfo() {
  return {
    driver: '@vercel/postgres (Neon)',
    connectionString: 'Neon connection string'
  };
}
