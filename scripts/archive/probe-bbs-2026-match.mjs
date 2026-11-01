/**
 * Offline match report: Big Balls season=2025 (March 2026) → tournament-2026.json names.
 * Does not write to the database.
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

const { normalizeBbsTournamentRow } = await import(
  '../src/lib/bigBalls/tournamentClient.ts'
);
const { normalizeTeamName } = await import(
  '../src/lib/services/scoreboardSyncService.ts'
);

const k = process.env.API_KEY_BIGBALL;
if (!k) {
  console.error('API_KEY_BIGBALL missing');
  process.exit(1);
}

const tourney = JSON.parse(
  readFileSync('public/data/tournament-2026.json', 'utf8'),
);
const ourByNorm = new Map();
for (const region of tourney.regions) {
  for (const team of region.teams) {
    ourByNorm.set(normalizeTeamName(team.name), team.name);
    if (team.playIn?.teams) {
      for (const p of team.playIn.teams) {
        ourByNorm.set(normalizeTeamName(p.name), p.name);
      }
    }
  }
}

const r = await fetch(
  'https://api.bigballsdata.com/v1/ncaab/tournament?season=2025&limit=200',
  { headers: { Authorization: `Bearer ${k}`, Accept: 'application/json' } },
);
const j = await r.json();
const men = (j.data || [])
  .filter((row) => row && typeof row === 'object')
  .map((row) => normalizeBbsTournamentRow(row))
  .filter((m) => m.draw === 'men');

let both = 0;
let one = 0;
let none = 0;
const missing = [];
for (const m of men) {
  const h = m.homeName ? ourByNorm.has(normalizeTeamName(m.homeName)) : false;
  const a = m.awayName ? ourByNorm.has(normalizeTeamName(m.awayName)) : false;
  if (h && a) both += 1;
  else if (h || a) {
    one += 1;
    missing.push(
      `${m.homeName}${h ? '' : ' (miss)'} vs ${m.awayName}${a ? '' : ' (miss)'} r${m.round}`,
    );
  } else {
    none += 1;
    missing.push(`${m.homeName} vs ${m.awayName} r${m.round} (both miss)`);
  }
}

console.log(
  JSON.stringify(
    {
      season: 2025,
      appYear: 2026,
      menGames: men.length,
      bothTeamsInAppBracket: both,
      oneTeam: one,
      neither: none,
      withTipoff: men.filter((m) => m.tipoffAt).length,
      finals: men.filter((m) => m.status === 'final').length,
      sampleMisses: missing.slice(0, 12),
    },
    null,
    2,
  ),
);
