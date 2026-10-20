import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newDb, DataType } from 'pg-mem';
import type { Pool } from 'pg';
import { canonicalTournament, createPlayInTeam, resolveFirstFour, validateFirstFourResults, validateTournamentDefinition } from '../src/lib/tournamentDefinition';
import { generate64TeamBracket, getAllBracketGames, updateBracketWithPicks } from '../src/lib/bracketGenerator';
import { buildKeyResolvedGames, scorePicksAgainstKey } from '../src/lib/liveStandingsScoring';
import { assembleLiveStandingsData } from '../src/lib/liveStandingsStandingsAssembly';
import { addCombinedPlayInLogos } from '../src/lib/tournamentLogosServer';
import { applyDisplayNamesToTournamentData } from '../src/lib/teamDisplayName';
import { uniqueTournamentSchools } from '../src/components/admin/TournamentSchoolPicker';
import { saveTournamentWorkspace, tournamentScope } from '../src/lib/repositories/tournamentRepository';
import type { TournamentData } from '../src/types/tournament';
import type { BracketWithUser } from '../src/lib/types/database';

async function field(): Promise<TournamentData> {
  const d = JSON.parse(await readFile('public/data/tournament-2026.json', 'utf8')) as TournamentData;
  d.year = '2027';
  for (let i = 0; i < 4; i++) {
    const region = d.regions[i];
    const old = region.teams.find(t => t.id.match(/^500[1-4]$/)) || region.teams[1];
    const pair = [{ id: String(9000 + i * 2), name: `School ${i} A`, logo: '/logos/teams/150.png' }, { id: String(9001 + i * 2), name: `School ${i} B`, logo: '/logos/teams/130.png' }] as const;
    region.teams = region.teams.map(t => t.id === old.id ? createPlayInTeam('2027', region.position, old.seed, [{ ...pair[0] }, { ...pair[1] }]) : t);
  }
  return canonicalTournament(d);
}

test('four real pairs create 64 slots and exactly 63 scored games', async () => {
  const d = await field();
  assert.deepEqual(validateTournamentDefinition(d), []);
  assert.equal(d.regions.flatMap(r => r.teams).length, 64);
  assert.equal(getAllBracketGames(generate64TeamBracket(d)).length, 63);
  assert.equal(d.regions.flatMap(r => r.teams).filter(t => t.playIn).length, 4);
  const duplicate = structuredClone(d);
  duplicate.regions[1].teams[0].id = d.regions[0].teams[0].id;
  assert.match(validateTournamentDefinition(duplicate).join(' '), /already used/);
  assert.ok(validateTournamentDefinition({ ...d, year: '2026' }).length);
  assert.ok(validateTournamentDefinition({ regions: [null, null, null, null] }).length);
});

test('either survivor changes display only, preserving every saved pick and score', async () => {
  const d = await field();
  const picks: Record<string, string> = {};
  const base = generate64TeamBracket(d);
  // Advance each play-in slot when present, otherwise the first participant, through all rounds.
  for (const round of ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship']) {
    const games = getAllBracketGames(updateBracketWithPicks(base, picks, d)).filter(g => g.round === round);
    for (const g of games) picks[g.id] = (g.team1?.playIn ? g.team1 : g.team2?.playIn ? g.team2 : g.team1)!.id;
  }
  const original = JSON.stringify(picks);
  const expected = scorePicksAgainstKey(picks, picks, buildKeyResolvedGames(d, picks));
  for (const survivor of [0, 1]) {
    const results = Object.fromEntries(d.regions.flatMap(r => r.teams).filter(t => t.playIn).map(t => [t.id, t.playIn!.teams[survivor].id]));
    const resolved = resolveFirstFour(d, results);
    assert.equal(scorePicksAgainstKey(picks, picks, buildKeyResolvedGames(resolved, picks)), expected);
    assert.equal(scorePicksAgainstKey(picks, {}, buildKeyResolvedGames(resolved, {})), 0, 'First Four results award no points');
    assert.equal(JSON.stringify(picks), original);
    const team = resolved.regions[0].teams.find(t => t.playIn)!;
    assert.equal(team.name, team.playIn!.teams[survivor].name);
    assert.equal(team.id, d.regions[0].teams.find(t => t.playIn)!.id);
    const championship = updateBracketWithPicks(generate64TeamBracket(resolved), picks, resolved).championship;
    assert.ok(championship.team1?.playIn?.winnerId);
    const display = applyDisplayNamesToTournamentData(resolved, new Map([[team.playIn!.winnerId!, 'Custom Survivor']]));
    assert.equal(display.regions[0].teams.find(t => t.id === team.id)!.name, 'Custom Survivor');
    const standings = assembleLiveStandingsData(resolved, { id: 'key', picks }, [{ id: 'entry', userId: 'owner', picks, tieBreaker: 140, entryName: 'Example' } as BracketWithUser], new Date().toISOString());
    assert.equal(standings.entries[0].points, expected);
    assert.ok(standings.entries[0].finalFour.includes(team.name));
    assert.equal(standings.teamLogos?.[team.name], team.logo);
  }
  assert.equal(validateFirstFourResults(d, { bad: '150' }), false);
  const slot = d.regions[0].teams.find(t => t.playIn)!;
  assert.equal(validateFirstFourResults(d, { [slot.id]: '150' }), false);
  assert.deepEqual(resolveFirstFour(resolveFirstFour(d, { [slot.id]: slot.playIn!.teams[0].id }), {}).regions[0].teams.find(t => t.id === slot.id)?.playIn?.winnerId, undefined);
});

test('combined logos are self-contained and aliases appear once', async () => {
  const d = await field();
  const withLogos = await addCombinedPlayInLogos(d);
  const team = withLogos.regions[0].teams.find(t => t.playIn)!;
  const svg = Buffer.from(team.logo.split(',')[1], 'base64').toString();
  assert.match(svg, /data:image\/png;base64/);
  assert.equal((svg.match(/<image/g) || []).length, 2);
  const s = team.playIn!.teams[0];
  assert.equal(uniqueTournamentSchools([s, { ...s, name: 'Alias' }]).length, 1);
});

test('draft/publish/results have revisions, audit history, environment isolation and field freeze', async () => {
  process.env.APP_ENV = 'local';
  const memory = newDb({ noAstCoverageCheck: true });
  memory.public.registerFunction({ name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.integer, implementation: () => 1 });
  const pg = memory.adapters.createPg();
  const db = new pg.Pool() as unknown as Pool;
  await db.query('CREATE TABLE brackets (id TEXT, environment TEXT, year INTEGER)');
  const d = await field();
  const actor = 'admin@example.invalid';
  try {
    const draft = await saveTournamentWorkspace({ year: 2027, revision: 0, actor, action: 'draft', definition: d }, db);
    assert.equal(draft.published, null);
    const published = await saveTournamentWorkspace({ year: 2027, revision: 1, actor, action: 'publish', definition: d }, db);
    assert.deepEqual(published.published, d);
    const slot = d.regions[0].teams.find(t => t.playIn)!;
    const results = { [slot.id]: slot.playIn!.teams[0].id };
    const updated = await saveTournamentWorkspace({ year: 2027, revision: 2, actor, action: 'results', results }, db);
    assert.deepEqual(updated.results, results);
    await assert.rejects(saveTournamentWorkspace({ year: 2027, revision: 2, actor, action: 'results', results }, db), /another window/);
    assert.equal((await db.query('SELECT * FROM tournament_workspace_history')).rows.length, 3);
    const next = structuredClone(d); next.name = 'Next draft';
    await saveTournamentWorkspace({ year: 2027, revision: 3, actor, action: 'draft', definition: next }, db);
    assert.equal((await db.query('SELECT published FROM tournament_workspaces')).rows[0].published.name, d.name);
    await db.query("INSERT INTO brackets VALUES ('entry','local',2027)");
    await assert.rejects(saveTournamentWorkspace({ year: 2027, revision: 4, actor, action: 'publish', definition: next }, db), /already has brackets/);
    const corrected = await saveTournamentWorkspace({ year: 2027, revision: 4, actor, action: 'results', results: {} }, db);
    assert.deepEqual(corrected.results, {});
    process.env.APP_ENV = 'preview'; process.env.VERCEL_GIT_COMMIT_REF = 'feature/test';
    const featureScope = tournamentScope();
    process.env.VERCEL_GIT_COMMIT_REF = 'staging';
    assert.notEqual(tournamentScope(), featureScope);
    assert.notEqual(tournamentScope(), 'production');
    process.env.APP_ENV = 'production';
    assert.equal(tournamentScope(), 'production');
  } finally { await db.end(); }
});
