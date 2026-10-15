import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import { assertDedicatedVintageDatabase } from "../src/lib/vintage/databaseSafety";
import { initializeVintageHomepageDatabase } from "../src/lib/database/migrations";
async function main() {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.APP_ENV === "production"
  )
    throw new Error("Vintage V1 setup is not allowed in production.");
  const url = process.env.VINTAGE_DATABASE_URL;
  if (!url) throw new Error("VINTAGE_DATABASE_URL is required.");
  assertDedicatedVintageDatabase(url);
  const pool = new Pool({ connectionString: url });
  try {
    await initializeVintageHomepageDatabase(pool);
    console.log("Vintage homepage schema is ready.");
  } finally {
    await pool.end();
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
