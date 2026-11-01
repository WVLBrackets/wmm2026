import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getTournamentWorkspace } from '@/lib/repositories/tournamentRepository';
import { FIRST_MANAGED_YEAR, resolveFirstFour } from '@/lib/tournamentDefinition';
import type { TournamentData } from '@/types/tournament';
import { addCombinedPlayInLogos } from '@/lib/tournamentLogosServer';

/**
 * Years that have a canonical `public/data/tournament-YYYY.json` field file
 * (excludes `-test` / `-old` variants). Newest first.
 */
let cachedFieldYears: number[] | null = null;

export function listTournamentFieldYears(): number[] {
  if (cachedFieldYears) return cachedFieldYears;
  const dir = path.join(process.cwd(), 'public', 'data');
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    cachedFieldYears = [];
    return cachedFieldYears;
  }
  const years = new Set<number>();
  for (const name of names) {
    const match = /^tournament-(20\d{2})\.json$/.exec(name);
    if (match) years.add(Number(match[1]));
  }
  cachedFieldYears = Array.from(years).sort((a, b) => b - a);
  return cachedFieldYears;
}

export async function loadLegacyTournament(year: string): Promise<TournamentData | null> {
  if (!/^20\d{2}$/.test(year)) throw new Error('Invalid tournament year.');
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', `tournament-${year}.json`), 'utf8')) as TournamentData;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function tryLoadTournamentData(year: string): Promise<TournamentData | null> {
  if (!/^20\d{2}$/.test(year)) throw new Error('Invalid tournament year.');
  if (Number(year) >= FIRST_MANAGED_YEAR) {
    const workspace = await getTournamentWorkspace(Number(year));
    if (workspace.published) return addCombinedPlayInLogos(resolveFirstFour(workspace.published, workspace.results));
  }
  return loadLegacyTournament(year);
}

/**
 * Friendly copy when a year’s published field JSON is missing.
 *
 * @param year - Tournament year to name in the message
 */
export function unpublishedTournamentMessage(year: string): string {
  return `The Tournament Bracket for ${year} is not published yet.`;
}

export async function loadTournamentData(year: string): Promise<TournamentData> {
  const data = await tryLoadTournamentData(year);
  if (!data) throw new Error(unpublishedTournamentMessage(year));
  return data;
}
