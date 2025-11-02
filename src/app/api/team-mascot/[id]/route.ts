import { NextRequest, NextResponse } from 'next/server';
import { getAllTeamReferenceData } from '@/lib/secureDatabase';

/**
 * GET /api/team-mascot/[id]
 * Get the mascot for a team by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    
    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Get all team data and find the team by ID
    const allTeams = await getAllTeamReferenceData(false);
    const teamMatch = Object.values(allTeams).find(team => team.id === teamId);
    
    if (teamMatch?.mascot) {
      return NextResponse.json({
        success: true,
        mascot: teamMatch.mascot
      });
    }
    
    // Return empty if no mascot found
    return NextResponse.json({
      success: true,
      mascot: null
    });
  } catch (error) {
    console.error('Error getting team mascot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get team mascot' },
      { status: 500 }
    );
  }
}

