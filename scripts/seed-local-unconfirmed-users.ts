/**
 * Seed a few **unconfirmed** users in the **local** database for Admin → Users testing
 * (e.g. the "Unconfirmed" filter).
 *
 * Loads `.env.local` then `.env`. Forces `APP_ENV=local` so {@link getCurrentEnvironment}
 * resolves to `local` and uses `LOCAL_POSTGRES_URL` / `POSTGRES_URL_LOCAL`.
 *
 * @example
 * ```bash
 * npm run seed:local-unconfirmed
 * ```
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

process.env.APP_ENV = 'local';

const DEFAULT_PASSWORD = 'LocalUnconfirmed1!';

const SEED_USERS: ReadonlyArray<{ email: string; name: string; password: string }> = [
  { email: 'unconfirmed-local-1@example.test', name: 'Local Unconfirmed One', password: DEFAULT_PASSWORD },
  { email: 'unconfirmed-local-2@example.test', name: 'Local Unconfirmed Two', password: DEFAULT_PASSWORD },
  { email: 'unconfirmed-local-3@example.test', name: 'Local Unconfirmed Three', password: DEFAULT_PASSWORD },
];

/**
 * Creates seed users via the same path as registration (bcrypt, confirmation token).
 */
async function main(): Promise<void> {
  const { createUser } = await import('../src/lib/repositories/userRepository');

  console.log('\nSeeding unconfirmed users (APP_ENV=local)…\n');

  let created = 0;
  let skipped = 0;

  for (const u of SEED_USERS) {
    try {
      await createUser(u.email, u.name, u.password);
      console.log(`  ✓ Created: ${u.email} (${u.name})`);
      created += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already exists')) {
        console.log(`  · Skipped (already exists): ${u.email}`);
        skipped += 1;
      } else {
        console.error(`  ✗ Failed: ${u.email}`, err);
        process.exitCode = 1;
        return;
      }
    }
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}.`);
  console.log(`Shared password (for after you confirm, or for reference): ${DEFAULT_PASSWORD}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
