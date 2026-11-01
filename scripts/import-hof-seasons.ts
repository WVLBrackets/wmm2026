/**
 * One-time Hall of Fame import: create `hof_seasons` and seed from the
 * bundled 2000–2026 podium snapshot (retired Google Sheet).
 *
 * Usage: npm run hof:import
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { HOF_SEASONS_SEED } from "../src/lib/hofSeasonsSeed";
import {
  seedHofSeasonsIfEmpty,
  upsertHofSeason,
} from "../src/lib/repositories/hofSeasonRepository";

async function main(): Promise<void> {
  await seedHofSeasonsIfEmpty();
  let count = 0;
  for (const entry of HOF_SEASONS_SEED) {
    await upsertHofSeason(entry);
    count += 1;
  }
  console.log(`Imported ${count} Hall of Fame seasons.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
