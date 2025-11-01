import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { promises as fs } from 'fs';
import path from 'path';

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

    // Read the team-mappings.json file
    const filePath = path.join(process.cwd(), 'public', 'data', 'team-mappings.json');
    const fileContents = await fs.readFile(filePath, 'utf8');
    const teamData = JSON.parse(fileContents);

    return NextResponse.json({
      success: true,
      data: teamData,
    });
  } catch (error) {
    console.error('Error reading team data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read team data' },
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

    // Sort teams by ID (numeric)
    const sortedTeams = Object.fromEntries(
      Object.entries(teams).sort((a, b) => {
        const idA = parseInt((a[1] as { id: string }).id) || 0;
        const idB = parseInt((b[1] as { id: string }).id) || 0;
        return idA - idB;
      })
    );

    // Write the sorted data back to the file
    const filePath = path.join(process.cwd(), 'public', 'data', 'team-mappings.json');
    await fs.writeFile(filePath, JSON.stringify(sortedTeams, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Team data updated successfully',
      count: Object.keys(sortedTeams).length,
    });
  } catch (error) {
    console.error('Error updating team data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update team data' },
      { status: 500 }
    );
  }
}

