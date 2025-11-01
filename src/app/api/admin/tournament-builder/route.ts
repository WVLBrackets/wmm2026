import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * POST /api/admin/tournament-builder - Save tournament bracket JSON
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const tournamentData = await request.json();

    // Validate required fields
    if (!tournamentData.year || !tournamentData.name || !tournamentData.regions) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: year, name, and regions are required' },
        { status: 400 }
      );
    }

    // Validate regions
    if (!Array.isArray(tournamentData.regions) || tournamentData.regions.length !== 4) {
      return NextResponse.json(
        { success: false, error: 'Must have exactly 4 regions' },
        { status: 400 }
      );
    }

    // Validate each region has 16 teams
    for (const region of tournamentData.regions) {
      if (!region.teams || !Array.isArray(region.teams) || region.teams.length !== 16) {
        return NextResponse.json(
          { success: false, error: `Region "${region.name}" must have exactly 16 teams` },
          { status: 400 }
        );
      }
    }

    // Check if we're in a writable environment (development or build time)
    // In production/staging on Vercel, we can't write files, so we'll return the JSON for download
    const isVercel = process.env.VERCEL === '1';
    
    if (!isVercel && typeof window === 'undefined') {
      // Try to write to public/data/tournament-{year}.json in development
      try {
        const filePath = path.join(process.cwd(), 'public', 'data', `tournament-${tournamentData.year}.json`);
        const jsonContent = JSON.stringify(tournamentData, null, 2);
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonContent, 'utf8');
        
        return NextResponse.json({
          success: true,
          message: `Tournament ${tournamentData.year} saved successfully`,
          filePath: `/data/tournament-${tournamentData.year}.json`,
        });
      } catch (fileError) {
        console.error('Error writing file:', fileError);
        // Fall through to return JSON for download
      }
    }

    // Return the JSON data for the client to handle (download or commit)
    return NextResponse.json({
      success: true,
      message: 'Tournament data ready',
      data: tournamentData,
      filename: `tournament-${tournamentData.year}.json`,
      note: 'In Vercel, files cannot be written directly. Download this JSON and commit it to the repository.',
    });
  } catch (error) {
    console.error('Error saving tournament:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save tournament' 
      },
      { status: 500 }
    );
  }
}

