import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GET /api/admin/tournament-files - List available tournament JSON files
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

    const tournamentFiles: string[] = [];

    // Try to read from public/data directory
    try {
      const dataDir = path.join(process.cwd(), 'public', 'data');
      
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir);
        const tournamentPattern = /^tournament-\d{4}\.json$/;
        
        files.forEach(file => {
          if (tournamentPattern.test(file)) {
            tournamentFiles.push(file);
          }
        });
        
        // Sort by year descending (newest first)
        tournamentFiles.sort((a, b) => {
          const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0');
          const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0');
          return yearB - yearA;
        });
      }
    } catch (fileError) {
      console.error('Error reading tournament files:', fileError);
      // Continue with empty list - this is okay for Vercel where filesystem access is limited
    }

    return NextResponse.json({
      success: true,
      files: tournamentFiles,
    });
  } catch (error) {
    console.error('Error listing tournament files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list tournament files' 
      },
      { status: 500 }
    );
  }
}

