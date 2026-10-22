import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.VINTAGE_DATABASE_URL,
  max: 1,
});
try {
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY 1
  `);
  console.log(
    "tables:",
    tables.rows.map((row) => row.table_name).join(", "),
  );
  const priv = await pool.query(`
    SELECT
      current_user AS role,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create,
      has_table_privilege(current_user, 'vintage_homepage', 'SELECT') AS homepage_select,
      has_table_privilege(current_user, 'vintage_homepage', 'UPDATE') AS homepage_update
  `);
  console.log("priv:", priv.rows[0]);
} finally {
  await pool.end();
}
