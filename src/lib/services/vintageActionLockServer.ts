/**
 * Server-only vintage Action Lock: fresh CMS + field JSON evaluation.
 * Kept separate from `vintageActionLock.ts` so client components never pull
 * nodemailer / adminNotifications into the browser bundle.
 */

import { notifyAdminOfError } from '@/lib/adminNotifications';
import { tryLoadTournamentData } from '@/lib/tournamentLoaderServer';
import type { VintageContent } from '@/lib/vintage/content';
import type { VintagePicksContent } from '@/lib/vintage/picksContent';
import { getPublishedVintagePicksContent } from '@/lib/vintage/picksStore';
import { getPublishedVintageContent } from '@/lib/vintage/store';
import {
  evaluateVintageActionLock,
  type VintageActionKind,
  type VintageActionLockResult,
} from '@/lib/services/vintageActionLock';

/**
 * Load published CMS + field JSON and evaluate (fresh; for APIs).
 * Notifies admin once (rate-limited) when published but JSON is missing.
 */
export async function evaluateVintageActionLockFresh(options: {
  action: VintageActionKind;
  bracketYear: number;
  nowMs?: number;
  /** When provided, skip re-fetching published CMS. */
  home?: VintageContent;
  picksCopy?: VintagePicksContent;
}): Promise<
  VintageActionLockResult & {
    activeYear: number;
    home: VintageContent;
    picksCopy: VintagePicksContent;
  }
> {
  const [home, picksCopy] = await Promise.all([
    options.home
      ? Promise.resolve(options.home)
      : getPublishedVintageContent(),
    options.picksCopy
      ? Promise.resolve(options.picksCopy)
      : getPublishedVintagePicksContent(),
  ]);

  const activeYear = parseInt(String(home.tournament.year).trim(), 10);
  if (Number.isNaN(activeYear)) {
    return {
      blocked: true,
      reasonCode: 'brackets_missing_json',
      message: 'Active Tourney Year is not configured on the homepage.',
      activeYear: options.bracketYear,
      home,
      picksCopy,
    };
  }

  const tournamentData = await tryLoadTournamentData(String(activeYear));
  const result = evaluateVintageActionLock({
    action: options.action,
    bracketYear: options.bracketYear,
    activeYear,
    picksCopy,
    tipoffAt: home.tournament.tipoffAt,
    bracketsReadyAt: home.tournament.bracketsReadyAt,
    tournamentJsonPresent: Boolean(tournamentData),
    nowMs: options.nowMs,
  });

  if (
    result.reasonCode === 'brackets_missing_json' &&
    picksCopy.bracketsPublished
  ) {
    void notifyAdminOfError(
      new Error(
        result.message || 'Tournament JSON missing while brackets published',
      ),
      'Vintage My Picks - Missing tournament JSON',
      {
        additionalDetails: {
          activeYear,
          bracketYear: options.bracketYear,
          action: options.action,
        },
      },
    );
  }

  return { ...result, activeYear, home, picksCopy };
}
