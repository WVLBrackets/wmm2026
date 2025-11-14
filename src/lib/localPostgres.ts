import { Pool } from 'pg';

// Create a connection pool for local PostgreSQL
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_LOCAL;
    if (!connectionString) {
      throw new Error('DATABASE_URL_LOCAL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString,
      ssl: false, // Local PostgreSQL doesn't need SSL
    });
  }
  return pool;
}

// SQL template literal function that mimics @vercel/postgres
const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const pool = getPool();
  
  // Build the query string by interpolating values directly
  let query = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    // Escape single quotes in string values
    const escapedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
    query += escapedValue + strings[i + 1];
  }
  
  return pool.query(query);
};

// Export both named and default exports
const localPostgresAdapter = { sql };
export { sql };
export default localPostgresAdapter;

// Close the pool when needed
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
