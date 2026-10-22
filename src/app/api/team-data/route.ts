import { NextRequest, NextResponse } from 'next/server';
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';
import { initializeTeamDataTable } from '@/lib/database/migrations';
import { getTeamReferenceDisplayName } from '@/lib/teamDisplayName';
import { getFallbackTeamData } from '@/lib/teamRefData';
import {
  getCachedPublicTeamData,
  setCachedPublicTeamData,
  TEAM_DATA_PUBLIC_CACHE_MS,
  type PublicTeamDataRow,
} from '@/lib/teamDataPublicCache';

/**
 * GET /api/team-data - Get all team reference data (public read-only endpoint)
 * Query params: activeOnly (boolean) - if true, only return active teams
 *
 * Performance: In-memory cache (see teamDataPublicCache); invalidated on any team DB write.
 */
export async function GET(request: NextRequest) {
  const now = Date.now();
  const cached = getCachedPublicTeamData(now);
  if (cached) {
    return NextResponse.json(
      {
        success: true,
        data: cached,
      },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${Math.floor(TEAM_DATA_PUBLIC_CACHE_MS / 1000)}, stale-while-revalidate=${Math.floor((TEAM_DATA_PUBLIC_CACHE_MS * 2) / 1000)}`,
        },
      }
    );
  }
  try {
    await initializeTeamDataTable();

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const teamData = await getAllTeamReferenceData(activeOnly);

    const teamRefData: PublicTeamDataRow[] = Object.entries(teamData)
      .filter(([, teamInfo]) => teamInfo.active !== false)
      .map(([abbr, teamInfo]) => {
        const customRaw = teamInfo.displayName?.trim();
        const customDisplayName =
          customRaw && customRaw.length > 0 ? customRaw : null;
        return {
          abbr,
          id: teamInfo.id,
          name: teamInfo.name,
          displayName: getTeamReferenceDisplayName(teamInfo),
          customDisplayName,
        };
      });

    setCachedPublicTeamData(teamRefData, now);

    return NextResponse.json(
      {
        success: true,
        data: teamRefData,
      },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${Math.floor(TEAM_DATA_PUBLIC_CACHE_MS / 1000)}, stale-while-revalidate=${Math.floor((TEAM_DATA_PUBLIC_CACHE_MS * 2) / 1000)}`,
        },
      }
    );
  } catch (error) {
    // Local/dev and transient DB outages: serve hardcoded fallback so logo
    // lookups (Hall of Fame cards, etc.) do not hard-fail with 500.
    console.error('Error reading team data, serving fallback:', error);
    const fallback: PublicTeamDataRow[] = getFallbackTeamData().map((row) => ({
      abbr: row.abbr,
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      customDisplayName: row.customDisplayName ?? null,
    }));
    setCachedPublicTeamData(fallback, now);
    return NextResponse.json(
      {
        success: true,
        data: fallback,
        fallback: true,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  }
}
