/**
 * Quick status dump for a scoreboard year.
 * Usage: node --import tsx scripts/inspect-scoreboard-year.mjs 2026
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const year = Number(process.argv.find((a) => /^\d{4}$/.test(a)) || '2026');
const { listScoreboardGames } = await import(
  '../src/lib/repositories/scoreboardRepository.ts'
);
const games = await listScoreboardGames(year);
const finals = games.filter((g) => g.status === 'final');
const sched = games.filter((g) => g.status !== 'final');
console.log(
  JSON.stringify(
    {
      year,
      total: games.length,
      finals: finals.length,
      scheduled: sched.length,
      finalSample: finals.slice(0, 5).map((g) => ({
        k: g.gameKey,
        t1: g.team1Name,
        t2: g.team2Name,
        s1: g.score1,
        s2: g.score2,
        w: g.winnerId,
        source: g.source,
      })),
      scheduledBothTeams: sched.filter((g) => g.team1Name && g.team2Name).length,
      scheduledGames: sched.map((g) => ({
        k: g.gameKey,
        r: g.roundLabel,
        t1: g.team1Name,
        t2: g.team2Name,
      })),
      emptySlots: sched
        .filter((g) => !g.team1Name || !g.team2Name)
        .slice(0, 10)
        .map((g) => ({
          k: g.gameKey,
          r: g.roundLabel,
          t1: g.team1Name,
          t2: g.team2Name,
        })),
    },
    null,
    2,
  ),
);
