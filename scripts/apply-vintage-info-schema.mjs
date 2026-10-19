/**
 * One-shot: create vintage_info tables using VINTAGE_DATABASE_URL from .env.local.
 * Run: node --env-file=.env.local scripts/apply-vintage-info-schema.mjs
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.VINTAGE_DATABASE_URL;
if (!url) {
  console.error("VINTAGE_DATABASE_URL is not set.");
  process.exit(1);
}

const sql = readFileSync(join(root, "scripts/vintage-info-schema.sql"), "utf8")
  // Strip grant comments / example lines — CREATE only.
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await pool.query(sql);
  const check = await pool.query(
    "SELECT to_regclass('public.vintage_info') AS info, to_regclass('public.vintage_info_revisions') AS revisions",
  );
  console.log("Handbook schema ready:", check.rows[0]);
} catch (error) {
  console.error(
    "Schema apply failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
