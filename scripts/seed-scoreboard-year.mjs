/**
 * Seed scoreboard games from tournament-{year}.json, then optionally sync from BBS.
 *
 * Usage:
 *   node --import tsx scripts/seed-scoreboard-year.mjs 2026
 *   node --import tsx scripts/seed-scoreboard-year.mjs 2026 --sync
 *   node --import tsx scripts/seed-scoreboard-year.mjs 2026 --sync --force-slots
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

const yearArg = process.argv.find((a) => /^\d{4}$/.test(a));
const year = yearArg ? Number(yearArg) : NaN;
const doSync = process.argv.includes('--sync');
const forceSlots = process.argv.includes('--force-slots');

if (!Number.isInteger(year) || year < 2000 || year > 9999) {
  console.error('Usage: node --import tsx scripts/seed-scoreboard-year.mjs YYYY [--sync] [--force-slots]');
  process.exit(1);
}

const { ensureScoreboardSeeded } = await import(
  '../src/lib/services/scoreboardService.ts'
);
const {
  ensureDefaultPageAssignments,
  ensureChampionshipPageSplit,
  rebuildScoreboardSnapshot,
} = await import('../src/lib/services/publicScoreboardService.ts');
const { listScoreboardGames } = await import(
  '../src/lib/repositories/scoreboardRepository.ts'
);
const { syncScoreboardFromBbs } = await import(
  '../src/lib/services/scoreboardSyncService.ts'
);
const { getUserByEmail } = await import(
  '../src/lib/repositories/userRepository.ts'
);

const inserted = await ensureScoreboardSeeded(year, {
  forceRefreshSlots: forceSlots,
});
await ensureDefaultPageAssignments(year);
await ensureChampionshipPageSplit(year);

const games = await listScoreboardGames(year);
console.log(
  JSON.stringify(
    {
      year,
      insertedHint: inserted,
      gameCount: games.length,
      byStatus: games.reduce((acc, g) => {
        acc[g.status] = (acc[g.status] || 0) + 1;
        return acc;
      }, {}),
    },
    null,
    2,
  ),
);

if (!doSync) {
  await rebuildScoreboardSnapshot(year);
  console.log('Snapshot rebuilt (no BBS sync). Pass --sync to pull Big Balls.');
  process.exit(0);
}

const actorOverride = process.env.SCOREBOARD_SYNC_ACTOR_USER_ID?.trim();
const adminEmail = process.env.ADMIN_EMAIL?.trim();
let actorUserId = actorOverride || null;
if (!actorUserId && adminEmail) {
  const admin = await getUserByEmail(adminEmail);
  actorUserId = admin?.id ?? null;
}
if (!actorUserId) {
  console.error(
    'No sync actor: set ADMIN_EMAIL (registered user) or SCOREBOARD_SYNC_ACTOR_USER_ID',
  );
  process.exit(1);
}

const summary = await syncScoreboardFromBbs(year, actorUserId, true);
const after = await listScoreboardGames(year);
console.log(
  JSON.stringify(
    {
      sync: summary,
      afterByStatus: after.reduce((acc, g) => {
        acc[g.status] = (acc[g.status] || 0) + 1;
        return acc;
      }, {}),
      withTipoff: after.filter((g) => g.tipoffAt).length,
      withScores: after.filter((g) => g.score1 != null && g.score2 != null).length,
    },
    null,
    2,
  ),
);
