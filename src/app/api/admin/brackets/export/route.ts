import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllBrackets } from '@/lib/secureDatabase';
import { getAllTeamReferenceData } from '@/lib/secureDatabase';

/**
 * GET /api/admin/brackets/export - Export brackets to CSV (admin only)
 * 
 * Query parameters (optional filters):
 * - status: Filter by bracket status (submitted, in_progress, deleted)
 * - userId: Filter by user ID
 * - year: Filter by year
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status');
    const filterUserId = searchParams.get('userId');
    const filterYear = searchParams.get('year');
    
    // Get all brackets
    let brackets = await getAllBrackets();
    
    // Apply filters (matching client-side filter logic)
    if (filterStatus && filterStatus !== 'all') {
      brackets = brackets.filter(b => b.status === filterStatus);
    }
    if (filterUserId && filterUserId !== 'all') {
      brackets = brackets.filter(b => b.userId === filterUserId);
    }
    if (filterYear && filterYear !== 'all') {
      const yearNum = parseInt(filterYear);
      if (!isNaN(yearNum)) {
        brackets = brackets.filter(b => b.year === yearNum);
      }
    }
    
    // Get team reference data for abbreviation mapping
    const teamData = await getAllTeamReferenceData(false);
    const teamIdToAbbr = new Map<string, string>();
    Object.entries(teamData).forEach(([abbr, teamInfo]) => {
      teamIdToAbbr.set(teamInfo.id, abbr);
    });
    
    // Generate game IDs in the correct order
    const regions = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'];
    
    // Round of 64: 8 games per region, ordered by region then game number
    const roundOf64GameIds: string[] = [];
    regions.forEach(region => {
      for (let i = 1; i <= 8; i++) {
        roundOf64GameIds.push(`${region}-r64-${i}`);
      }
    });
    
    // Round of 32: 4 games per region
    const roundOf32GameIds: string[] = [];
    regions.forEach(region => {
      for (let i = 1; i <= 4; i++) {
        roundOf32GameIds.push(`${region}-r32-${i}`);
      }
    });
    
    // Sweet 16: 2 games per region
    const sweet16GameIds: string[] = [];
    regions.forEach(region => {
      for (let i = 1; i <= 2; i++) {
        sweet16GameIds.push(`${region}-s16-${i}`);
      }
    });
    
    // Elite 8: 1 game per region
    const elite8GameIds: string[] = [];
    regions.forEach(region => {
      elite8GameIds.push(`${region}-e8-1`);
    });
    
    // Final Four: final-four-1 (left side), final-four-2 (right side)
    // Championship: championship
    
    // Helper function to get team abbreviation from team ID
    const getTeamAbbr = (teamId: string | undefined): string => {
      if (!teamId) return '';
      return teamIdToAbbr.get(teamId) || '';
    };
    
    // Helper function to escape CSV values
    const escapeCsvValue = (value: string | number | undefined | null): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    // Build CSV header
    const headers = [
      'Year',
      'Entry Name',
      ...roundOf64GameIds.map(id => `R64-${id}`),
      ...roundOf32GameIds.map(id => `R32-${id}`),
      ...sweet16GameIds.map(id => `S16-${id}`),
      ...elite8GameIds.map(id => `E8-${id}`),
      'Final Four Left',
      'Final Four Right',
      'Champion',
      'Tie Breaker',
      'Player Name',
      'Email',
      'Bracket ID',
      'Timestamp'
    ];
    
    // Build CSV rows
    const rows = brackets.map(bracket => {
      const picks = bracket.picks || {};
      
      // Get winners for each round
      const roundOf64Winners = roundOf64GameIds.map(id => getTeamAbbr(picks[id]));
      const roundOf32Winners = roundOf32GameIds.map(id => getTeamAbbr(picks[id]));
      const sweet16Winners = sweet16GameIds.map(id => getTeamAbbr(picks[id]));
      const elite8Winners = elite8GameIds.map(id => getTeamAbbr(picks[id]));
      const finalFourLeft = getTeamAbbr(picks['final-four-1']);
      const finalFourRight = getTeamAbbr(picks['final-four-2']);
      const champion = getTeamAbbr(picks['championship']);
      
      return [
        escapeCsvValue(bracket.year),
        escapeCsvValue(bracket.entryName),
        ...roundOf64Winners.map(escapeCsvValue),
        ...roundOf32Winners.map(escapeCsvValue),
        ...sweet16Winners.map(escapeCsvValue),
        ...elite8Winners.map(escapeCsvValue),
        escapeCsvValue(finalFourLeft),
        escapeCsvValue(finalFourRight),
        escapeCsvValue(champion),
        escapeCsvValue(bracket.tieBreaker),
        escapeCsvValue(bracket.userName),
        escapeCsvValue(bracket.userEmail),
        escapeCsvValue(bracket.id),
        escapeCsvValue(bracket.updatedAt.toISOString())
      ];
    });
    
    // Combine header and rows into CSV
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ];
    const csvContent = csvLines.join('\n');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `brackets-export-${timestamp}.csv`;
    
    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting brackets:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to export brackets' },
      { status: 500 }
    );
  }
}

