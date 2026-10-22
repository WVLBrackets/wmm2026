import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getTournamentWorkspace } from '@/lib/repositories/tournamentRepository';
import { FIRST_MANAGED_YEAR, resolveFirstFour } from '@/lib/tournamentDefinition';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import type { TournamentData } from '@/types/tournament';
import { addCombinedPlayInLogos } from '@/lib/tournamentLogosServer';

export async function loadLegacyTournament(year: string): Promise<TournamentData | null> {
  if (!/^20\d{2}$/.test(year)) throw new Error('Invalid tournament year.');
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', `tournament-${year}.json`), 'utf8')) as TournamentData;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function tryLoadTournamentData(year = String(FALLBACK_CONFIG.tournamentYear)): Promise<TournamentData | null> {
  if (!/^20\d{2}$/.test(year)) throw new Error('Invalid tournament year.');
  if (Number(year) >= FIRST_MANAGED_YEAR) {
    const workspace = await getTournamentWorkspace(Number(year));
    if (workspace.published) return addCombinedPlayInLogos(resolveFirstFour(workspace.published, workspace.results));
  }
  return loadLegacyTournament(year);
}

export async function loadTournamentData(year = String(FALLBACK_CONFIG.tournamentYear)): Promise<TournamentData> {
  const data = await tryLoadTournamentData(year);
  if (!data) throw new Error(`Tournament ${year} is not published yet.`);
  return data;
}
