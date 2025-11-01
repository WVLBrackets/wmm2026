import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getAllTeamReferenceData } from '@/lib/secureDatabase';

/**
 * GET /api/admin/team-data/export - Export team reference data as JSON file
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

    // Get team data from database
    const teamData = await getAllTeamReferenceData();

    // Sort teams by ID (numeric) for consistent output
    const sortedTeams = Object.fromEntries(
      Object.entries(teamData).sort((a, b) => {
        const idA = parseInt(a[1].id) || 0;
        const idB = parseInt(b[1].id) || 0;
        return idA - idB;
      })
    );

    // Convert to JSON string with proper formatting
    const jsonContent = JSON.stringify(sortedTeams, null, 2);

    // Return as downloadable file
    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="team-mappings.json"',
      },
    });
  } catch (error) {
    console.error('Error exporting team data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to export team data' 
      },
      { status: 500 }
    );
  }
}

