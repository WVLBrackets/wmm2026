import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';
import { getLiveStandingsSnapshot } from '@/lib/repositories/liveStandingsSnapshotRepository';
import {
  getKeyBracketByYear,
  listSubmittedEntryRosterForYear,
} from '@/lib/repositories/bracketRepository';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { getTournamentWorkspace } from '@/lib/repositories/tournamentRepository';
import { FIRST_MANAGED_YEAR } from '@/lib/tournamentDefinition';
import { getLegacyStandings } from '@/lib/legacyStandings';
import { isLegacyStandingsYear } from '@/lib/legacyStandings/years';
import { getPublishedVintageContent } from '@/lib/vintage/store';
import { getPublishedVintageStandingsContent } from '@/lib/vintage/standingsStore';
import { shouldUseStandingsRosterMode } from '@/lib/services/standingsRosterGate';
import {
  KEY_BRACKET_GAME_TOTAL,
  countKeyGamesComplete,
} from '@/lib/liveStandingsScoring';
import { loadTournamentData } from '@/lib/tournamentLoaderServer';
import type { StandingsData } from '@/lib/standingsData';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' } as const;
/** Snapshot payloads are KEY-driven; a short public cache is safe between writes. */
const SNAPSHOT_CACHE = {
  'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
} as const;

/**
 * Privacy-safe submitted-entry roster (names + optional mine flag).
 */
async function rosterResponse(yearNum: number): Promise<NextResponse> {
  const rows = await listSubmittedEntryRosterForYear(yearNum);
  let sessionUserId: string | null = null;
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const user = await getUserByEmail(session.user.email);
    sessionUserId = user?.id ?? null;
  }

  const entries = rows.map((row) => {
    const item: { entryName: string; mine?: boolean } = {
      entryName: row.entryName,
    };
    if (sessionUserId) {
      item.mine = row.userId === sessionUserId;
    }
    return item;
  });

  return NextResponse.json(
    {
      success: true,
      available: true,
      mode: 'roster',
      year: yearNum,
      totalEntryCount: entries.length,
      entries,
    },
    { headers: NO_STORE },
  );
}

/**
 * GET /api/live-standings?year=2026
 * Public read of cached live standings snapshot (recomputed when KEY is saved).
 * When Standings Tournament Live is off for the active homepage year: privacy-safe roster
 * (names + count only). Tipoff still locks entries via Action Lock separately.
 * If Live is on but no KEY/snapshot yet for the active year, fall back to roster
 * (avoids a blank "not available" page from flipping Live early).
 * Years ≤2025 with a packaged archive return that frozen final (no KEY recompute).
 * Public GET never recomputes; KEY save / admin Regenerate writes the snapshot.
 */
export async function GET(request: NextRequest) {
  try {
    const paramYear = request.nextUrl.searchParams.get('year');
    let yearNum: number;
    if (paramYear && /^\d{4}$/.test(paramYear)) {
      yearNum = parseInt(paramYear, 10);
    } else {
      try {
        const standings = await getPublishedVintageStandingsContent();
        const sy = standings.standingsYear?.trim() ?? '';
        yearNum = /^\d{4}$/.test(sy)
          ? parseInt(sy, 10)
          : await getActiveTournamentYear();
      } catch {
        yearNum = await getActiveTournamentYear();
      }
    }

    if (isLegacyStandingsYear(yearNum)) {
      const standingsData = getLegacyStandings(yearNum);
      if (standingsData) {
        const computedAt = standingsData.lastUpdated || '2025-04-08T00:00:00.000Z';
        // Archived finals years are complete tournament trees.
        const withProgress: StandingsData = {
          ...standingsData,
          keyGamesComplete:
            standingsData.keyGamesComplete ?? KEY_BRACKET_GAME_TOTAL,
          keyGamesTotal: standingsData.keyGamesTotal ?? KEY_BRACKET_GAME_TOTAL,
        };
        return NextResponse.json(
          {
            success: true,
            available: true,
            mode: 'standings',
            legacy: true,
            year: yearNum,
            keyBracketId: null,
            keyUpdatedAt: computedAt,
            computedAt,
            standingsData: withProgress,
          },
          {
            headers: {
              'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
          },
        );
      }
    }

    // Roster for the active homepage tourney year until Standings Tournament Live is on.
    const [home, standingsCopy] = await Promise.all([
      getPublishedVintageContent(),
      getPublishedVintageStandingsContent(),
    ]);
    const activeYear = parseInt(String(home.tournament.year).trim(), 10);
    if (
      !Number.isNaN(activeYear) &&
      shouldUseStandingsRosterMode(
        yearNum,
        activeYear,
        standingsCopy.tournamentLive,
      )
    ) {
      return rosterResponse(yearNum);
    }

    const snapshot = await getLiveStandingsSnapshot(yearNum);
    const revision = yearNum >= FIRST_MANAGED_YEAR ? (await getTournamentWorkspace(yearNum)).revision : undefined;
    const outdatedField = Boolean(snapshot) && revision !== undefined && snapshot!.standingsData.tournamentRevision !== revision;

    if (outdatedField) {
      return NextResponse.json(
        {
          success: false,
          error: 'Standings are refreshing after a tournament update. Please retry.',
        },
        { status: 503 },
      );
    }

    if (!snapshot) {
      // Live flipped on before KEY/snapshot exists — show roster for active year.
      if (!Number.isNaN(activeYear) && yearNum === activeYear) {
        return rosterResponse(yearNum);
      }
      return NextResponse.json(
        {
          success: true,
          available: false,
          mode: 'standings',
          year: yearNum,
          message: 'Live Standings Not Available',
        },
        { headers: NO_STORE },
      );
    }

    let standingsData = snapshot.standingsData;
    // Older snapshots lack progress fields — fill from current KEY without a full recompute.
    if (typeof standingsData.keyGamesComplete !== 'number') {
      try {
        const keyBracket = await getKeyBracketByYear(yearNum);
        if (keyBracket?.picks) {
          const tournamentData = await loadTournamentData(String(yearNum));
          const progress = countKeyGamesComplete(
            tournamentData,
            keyBracket.picks || {},
          );
          standingsData = {
            ...standingsData,
            keyGamesComplete: progress.complete,
            keyGamesTotal: progress.total,
          };
        }
      } catch (error) {
        console.warn('[GET /api/live-standings] key progress enrich failed', error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        available: true,
        mode: 'standings',
        year: snapshot.year,
        keyBracketId: snapshot.keyBracketId,
        keyUpdatedAt: snapshot.keyUpdatedAt.toISOString(),
        computedAt: snapshot.computedAt.toISOString(),
        standingsData,
      },
      { headers: SNAPSHOT_CACHE },
    );
  } catch (error) {
    console.error('[GET /api/live-standings]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load live standings' },
      { status: 500 }
    );
  }
}
