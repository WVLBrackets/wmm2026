/**
 * Recomputes live standings from KEY + submitted brackets and persists a snapshot.
 */

import { loadTournamentData } from '@/lib/tournamentLoader';
import {
  getSubmittedBracketsForLiveStandingsYear,
  getBracketById,
} from '@/lib/repositories/bracketRepository';
import {
  upsertLiveStandingsSnapshot,
  type LiveStandingsEntry,
} from '@/lib/repositories/liveStandingsSnapshotRepository';
import { buildKeyResolvedGames, scorePicksAgainstKey } from '@/lib/liveStandingsScoring';
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
    const keyPicks = keyBracket.picks || {};
    const keyGames = buildKeyResolvedGames(tournamentData, keyPicks);

    const submitted = await getSubmittedBracketsForLiveStandingsYear(year);

    const scored = submitted.map((b) => ({
      bracketId: b.id,
      entryName: b.entryName,
      userName: b.userName,
      userEmail: b.userEmail,
      points: scorePicksAgainstKey(b.picks || {}, keyPicks, keyGames),
    }));

    scored.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const name = a.entryName.localeCompare(b.entryName, undefined, { sensitivity: 'base' });
      if (name !== 0) return name;
      return a.bracketId.localeCompare(b.bracketId);
    });

    const entries: LiveStandingsEntry[] = [];
    let rank = 1;
    for (let i = 0; i < scored.length; i++) {
      if (i > 0 && scored[i].points < scored[i - 1].points) {
        rank = i + 1;
      }
      entries.push({
        bracketId: scored[i].bracketId,
        entryName: scored[i].entryName,
        userName: scored[i].userName,
        userEmail: scored[i].userEmail,
        points: scored[i].points,
        rank,
      });
    }

    const keyUpdatedAt = keyBracket.updatedAt ?? new Date();

    await upsertLiveStandingsSnapshot(year, keyBracketId, keyUpdatedAt, entries);

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
