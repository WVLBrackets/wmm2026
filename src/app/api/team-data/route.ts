import { NextRequest, NextResponse } from 'next/server';
import { getAllTeamReferenceData, initializeTeamDataTable } from '@/lib/secureDatabase';
import { TeamRefData } from '@/lib/teamRefData';

// Cache team data in memory to avoid repeated database queries
let cachedTeamData: { data: TeamRefData[]; timestamp: number } | null = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes - shorter cache for faster new team visibility

/**
 * GET /api/team-data - Get all team reference data (public read-only endpoint)
 * Query params: activeOnly (boolean) - if true, only return active teams
 * 
 * Performance: Uses in-memory cache + Next.js route caching for optimal performance
 */
export async function GET(request: NextRequest) {
  // Check in-memory cache first
  const now = Date.now();
  if (cachedTeamData && (now - cachedTeamData.timestamp) < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      data: cachedTeamData.data,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240', // 2 min CDN cache, 4 min stale
      },
    });
  }
  try {
    // Ensure team_reference_data table exists
    await initializeTeamDataTable();

    // Check for activeOnly query parameter
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Read from database
    const teamData = await getAllTeamReferenceData(activeOnly);

    // Transform to the format expected by client-side code
    const teamRefData = Object.entries(teamData)
      .filter(([, teamInfo]) => teamInfo.active !== false)
      .map(([abbr, teamInfo]) => ({
        abbr,
        id: teamInfo.id,
        name: teamInfo.name
      }));

    // Update in-memory cache
    cachedTeamData = {
      data: teamRefData,
      timestamp: now,
    };

    return NextResponse.json({
      success: true,
      data: teamRefData,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240', // 2 min CDN cache, 4 min stale
      },
    });
  } catch (error) {
    console.error('Error reading team data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to read team data' 
      },
      { status: 500 }
    );
  }
}

