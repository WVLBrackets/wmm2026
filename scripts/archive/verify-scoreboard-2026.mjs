import { config } from 'dotenv';
config({ path: '.env.local' });

const { setScoreboardDefaultYear } = await import(
  '../src/lib/repositories/scoreboardRepository.ts'
);
const { getPublicScoreboard, rebuildScoreboardSnapshot } = await import(
  '../src/lib/services/publicScoreboardService.ts'
);

await setScoreboardDefaultYear(2026);
await rebuildScoreboardSnapshot(2026);

const board = await getPublicScoreboard(2026, 'round-2');
const playIn = await getPublicScoreboard(2026, 'play-in');
console.log(
  JSON.stringify(
    {
      round2: {
        label: board.page.label,
        dateLabel: board.dateLabel,
        finals: board.completed.length,
      },
      playIn: {
        label: playIn.page.label,
        dateLabel: playIn.dateLabel,
        count: playIn.completed.length,
        sample: playIn.completed.map(
          (g) => `${g.team1Name} ${g.score1}-${g.score2} ${g.team2Name}`,
        ),
      },
    },
    null,
    2,
  ),
);
