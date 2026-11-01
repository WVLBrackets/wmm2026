import 'dotenv/config';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env.local' });
const k = process.env.API_KEY_BIGBALL;
if (!k) {
  console.error('API_KEY_BIGBALL missing');
  process.exit(1);
}

const r = await fetch(
  'https://api.bigballsdata.com/v1/ncaab/tournament?season=2025&limit=200',
  { headers: { Authorization: `Bearer ${k}`, Accept: 'application/json' } },
);
const j = await r.json();
const men = (j.data || []).filter((x) => x.gender === 'men');
console.log('men', men.length);
console.log('regions', [...new Set(men.map((x) => x.region_label))]);
console.log('FF', JSON.stringify(men.find((x) => x.round === 0), null, 2));
console.log('R64', JSON.stringify(men.find((x) => x.round === 1), null, 2));
console.log('Champ', JSON.stringify(men.find((x) => x.round === 6), null, 2));

const tourney = JSON.parse(
  readFileSync('public/data/tournament-2026.json', 'utf8'),
);
const ourNames = tourney.regions.flatMap((reg) =>
  reg.teams.flatMap((t) => {
    const names = [t.name];
    if (t.playIn?.teams) names.push(...t.playIn.teams.map((p) => p.name));
    return names;
  }),
);
const bbsNames = [
  ...new Set(
    men.flatMap((m) => [
      m.home_team?.full_name,
      m.away_team?.full_name,
      m.home_team?.school,
      m.away_team?.school,
    ]),
  ),
].filter(Boolean);

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\buniversity of\b/g, ' ')
    .replace(/\b(university|univ|college|the)\b/g, ' ')
    .replace(/\bof\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ourN = new Set(ourNames.map(norm));
let hit = 0;
const misses = [];
for (const n of bbsNames) {
  if (ourN.has(norm(n))) hit += 1;
  else misses.push(n);
}
console.log('name overlap bbs→our', hit, 'of', bbsNames.length);
console.log('sample misses', misses.slice(0, 15));
