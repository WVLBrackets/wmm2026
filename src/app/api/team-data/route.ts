import { NextRequest, NextResponse } from 'next/server';
import { getAllTeamReferenceData, initializeTeamDataTable } from '@/lib/secureDatabase';

/**
 * GET /api/team-data - Get all team reference data (public read-only endpoint)
 * Query params: activeOnly (boolean) - if true, only return active teams
 */
export async function GET(request: NextRequest) {
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
      .filter(([_, teamInfo]) => teamInfo.active !== false)
      .map(([abbr, teamInfo]) => ({
        abbr,
        id: teamInfo.id,
        name: teamInfo.name
      }));

    return NextResponse.json({
      success: true,
      data: teamRefData,
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

