/**
 * Recomputes live standings from KEY + submitted brackets and persists a snapshot.
 */

import { loadTournamentData } from '@/lib/tournamentLoader';
import { assembleLiveStandingsData } from '@/lib/liveStandingsStandingsAssembly';
import { getSubmittedBracketsForLiveStandingsYear, getBracketById } from '@/lib/repositories/bracketRepository';
import { upsertLiveStandingsSnapshot } from '@/lib/repositories/liveStandingsSnapshotRepository';
import { notifyAdminOfError } from '@/lib/adminNotifications';

/**
 * Recompute live standings for a tournament year after the KEY bracket was saved.
 * Sends admin email on failure; does not throw (caller decides HTTP response).
 */
export async function recomputeLiveStandingsAfterKeySave(
  year: number,
  keyBracketId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const keyBracket = await getBracketById(keyBracketId);
    if (!keyBracket?.isKey || keyBracket.year !== year) {
      return { ok: false, error: 'Invalid KEY bracket for live standings recompute' };
    }

    const tournamentData = await loadTournamentData(String(year));
    const submitted = await getSubmittedBracketsForLiveStandingsYear(year);
    const computedAtIso = new Date().toISOString();

    const standingsData = assembleLiveStandingsData(
      tournamentData,
      {
        id: keyBracket.id,
        picks: keyBracket.picks || {},
        tieBreaker: keyBracket.tieBreaker,
      },
      submitted,
      computedAtIso
    );

    const keyUpdatedAt = keyBracket.updatedAt ?? new Date();

    await upsertLiveStandingsSnapshot(year, keyBracketId, keyUpdatedAt, standingsData);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[recomputeLiveStandingsAfterKeySave]', error);

    await notifyAdminOfError(error instanceof Error ? error : new Error(message), 'live-standings-recompute', {
      bracketId: keyBracketId,
      additionalDetails: { year, message },
    });

    return { ok: false, error: message };
  }
}
