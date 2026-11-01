/**
 * Stamp published + draft CMS rows as schema v2 with every sidecar stored.
 * Required once per environment before public reads.
 *
 * Usage: npm run cms:migrate
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  getVintageDbPool,
  hasVintageDatabase,
} from "../src/lib/vintage/dbPool";
import {
  rebuildHomepageRow,
  withLockedHomepageRow,
} from "../src/lib/vintage/sidecarWriter";

async function main(): Promise<void> {
  if (!hasVintageDatabase()) {
    throw new Error("VINTAGE_DATABASE_URL is required.");
  }

  await withLockedHomepageRow(null, (current) =>
    rebuildHomepageRow(current, () => undefined),
  );

  const result = await getVintageDbPool().query(
    "SELECT version, published FROM vintage_homepage WHERE id = 1",
  );
  const row = result.rows[0];
  const published =
    row?.published && typeof row.published === "object"
      ? (row.published as Record<string, unknown>)
      : {};
  const schema = Number(published.__cmsSchema) || 0;
  console.log(
    `CMS schema migration complete. Row version: ${Number(row?.version) || 0}; published __cmsSchema: ${schema}`,
  );
  if (schema < 2) {
    throw new Error("Migration finished but published __cmsSchema is still below 2.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    if (hasVintageDatabase()) {
      await getVintageDbPool().end().catch(() => undefined);
    }
  });
