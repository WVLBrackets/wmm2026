import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { getDatabaseConfig, withPostgresSessionTimezoneUtc } from '@/lib/databaseConfig';
import { getAppEnvironment } from '@/lib/appEnvironment';
import { initializeTournamentWorkspace } from '@/lib/database/tournamentSchema';
import { sameTournamentDefinition, validateFirstFourResults, type FirstFourResults } from '@/lib/tournamentDefinition';
import type { TournamentData } from '@/types/tournament';

let pool: Pool;
export function tournamentPool(): Pool {
  pool ??= new Pool({ connectionString: withPostgresSessionTimezoneUtc(getDatabaseConfig().connectionString), max: 3 });
  return pool;
}

/** Preview branches sharing a DB must not overwrite staging or each other. */
export function tournamentScope(): string {
  const env = getAppEnvironment();
  if (env !== 'preview') return env;
  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (!branch) throw new Error('Preview tournament publishing requires VERCEL_GIT_COMMIT_REF to identify this environment.');
  return `preview:${createHash('sha256').update(branch).digest('hex').slice(0, 16)}`;
}

export interface TournamentWorkspace {
  revision: number;
  draft: TournamentData | null;
  published: TournamentData | null;
  results: FirstFourResults;
}
export const emptyWorkspace = (): TournamentWorkspace => ({ revision: 0, draft: null, published: null, results: {} });

export async function getTournamentWorkspace(year: number): Promise<TournamentWorkspace> {
  const db = tournamentPool();
  try {
    const r = await db.query('SELECT revision, draft, published, results FROM tournament_workspaces WHERE scope = $1 AND year = $2', [tournamentScope(), year]);
    return r.rows[0] ?? emptyWorkspace();
  } catch (e) {
    // Rolling deployment before the additive migration: legacy files still work.
    if ((e as { code?: string }).code === '42P01') return emptyWorkspace();
    throw e;
  }
}

export async function listManagedTournamentYears(): Promise<number[]> {
  try {
    const r = await tournamentPool().query('SELECT year FROM tournament_workspaces WHERE scope = $1 ORDER BY year DESC', [tournamentScope()]);
    return r.rows.map(row => Number(row.year));
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') return [];
    throw e;
  }
}

export class TournamentConflict extends Error {}

/** One transaction covers revision check, update, and immutable audit record. */
export async function saveTournamentWorkspace(options: {
  year: number; revision: number; actor: string;
  action: 'draft' | 'publish' | 'results';
  definition?: TournamentData; results?: FirstFourResults;
}, db: Pool = tournamentPool()): Promise<TournamentWorkspace> {
  await initializeTournamentWorkspace(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Serialize competing publications for this year.
    await client.query('SELECT pg_advisory_xact_lock($1)', [options.year]);
    const scope = tournamentScope();
    await client.query(`INSERT INTO tournament_workspaces (scope, year, updated_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [scope, options.year, options.actor]);
    const row = await client.query('SELECT revision, draft, published, results FROM tournament_workspaces WHERE scope=$1 AND year=$2 FOR UPDATE', [scope, options.year]);
    const current = row.rows[0] as TournamentWorkspace;
    if (current.revision !== options.revision) throw new TournamentConflict('This tournament changed in another window. Reload before saving.');
    let { draft, published, results } = current;
    if (options.action === 'draft') draft = options.definition!;
    if (options.action === 'publish') {
      const entries = await client.query('SELECT id FROM brackets WHERE environment=$1 AND year=$2 LIMIT 1', [getAppEnvironment(), options.year]);
      if (entries.rows.length && (!published || !sameTournamentDefinition(published, options.definition!))) {
        throw new TournamentConflict('This year already has brackets or KEY results. Its field cannot be replaced. First Four results can still be updated.');
      }
      published = options.definition!;
      draft = options.definition!;
      // Remove results only for slots whose participants changed before entries existed.
      results = Object.fromEntries(Object.entries(results).filter(([id, winner]) => {
        const before = current.published?.regions.flatMap(r => r.teams).find(t => t.id === id);
        const after = published!.regions.flatMap(r => r.teams).find(t => t.id === id);
        return JSON.stringify(before?.playIn?.teams) === JSON.stringify(after?.playIn?.teams) && after?.playIn?.teams.some(t => t.id === winner);
      }));
    }
    if (options.action === 'results') {
      if (!published || !validateFirstFourResults(published, options.results)) throw new Error('Each winner must belong to its published play-in matchup.');
      results = options.results!;
    }
    const revision = current.revision + 1;
    await client.query(`UPDATE tournament_workspaces SET revision=$3, draft=$4, published=$5, results=$6, updated_at=NOW(), updated_by=$7 WHERE scope=$1 AND year=$2`,
      [scope, options.year, revision, JSON.stringify(draft), JSON.stringify(published), JSON.stringify(results), options.actor]);
    await client.query(`INSERT INTO tournament_workspace_history (scope,year,revision,action,payload,actor) VALUES ($1,$2,$3,$4,$5,$6)`,
      [scope, options.year, revision, options.action, JSON.stringify(options.action === 'results' ? results : options.definition), options.actor]);
    // Invalidate the materialized display names; the existing live API recomputes on next read.
    const snapshotTable = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='live_standings_snapshots'");
    if (options.action !== 'draft' && snapshotTable.rows.length) await client.query('DELETE FROM live_standings_snapshots WHERE environment=$1 AND year=$2', [scope, options.year]);
    await client.query('COMMIT');
    return { revision, draft, published, results };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
