import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getAllTeamReferenceData, syncTeamDataFromJSON, updateTeamReferenceData, deleteTeamReferenceData, initializeTeamDataTable } from '@/lib/secureDatabase';

/**
 * GET /api/admin/team-data - Get all team reference data
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Ensure team_reference_data table exists
    await initializeTeamDataTable();

    // Sync from JSON only in development (staging/prod use database directly)
    await syncTeamDataFromJSON();

    // Read from database
    const teamData = await getAllTeamReferenceData();

    return NextResponse.json({
      success: true,
      data: teamData,
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

/**
 * PUT /api/admin/team-data - Update team reference data
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { teams } = body;

    if (!teams || typeof teams !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid team data format' },
        { status: 400 }
      );
    }

    // Ensure team_reference_data table exists
    await initializeTeamDataTable();

    // Type assertion for team data
    const teamsTyped = teams as Record<string, { id: string; name: string; mascot?: string; logo: string }>;

    // Sort teams by ID (numeric)
    const sortedTeams = Object.fromEntries(
      Object.entries(teamsTyped).sort((a, b) => {
        const idA = parseInt(a[1].id) || 0;
        const idB = parseInt(b[1].id) || 0;
        return idA - idB;
      })
    );

    // Update in database
    await updateTeamReferenceData(sortedTeams);

    return NextResponse.json({
      success: true,
      message: 'Team data updated successfully',
      count: Object.keys(sortedTeams).length,
    });
  } catch (error) {
    console.error('Error updating team data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update team data' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/team-data - Delete a team by key
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Team key is required' },
        { status: 400 }
      );
    }

    // Ensure team_reference_data table exists
    await initializeTeamDataTable();

    // Delete the team
    await deleteTeamReferenceData(key);

    return NextResponse.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete team' 
      },
      { status: 500 }
    );
  }
}

