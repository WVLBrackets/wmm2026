import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllBrackets } from '@/lib/repositories/bracketRepository';
import { getAllTeamReferenceData } from '@/lib/repositories/teamDataRepository';
import { encodeCsvUtf8WithBom, escapeCsvCell } from '@/lib/csvExport';

/**
 * GET /api/admin/brackets/export - Export all brackets to CSV (admin only)
 * 
 * CSV Format (75 columns):
 * 1. Friendly Bracket ID (YYYY-NNNNNN)
 * 2. Raw UUID
 * 3. Status
 * 4. Source
 * 5. Entry Name
 * 6. Player Name
 * 7. Player Name (duplicate)
 * 8. Player Email
 * 9. Updated Timestamp
 * 10. Submitted Timestamp from `brackets.submitted_at` (blank if not submitted or unset)
 * 11. Entry Name (duplicate)
 * 12-43. Round 1 picks (32) - 8 per region: top-left, bottom-left, top-right, bottom-right
 * 44-59. Round 2 picks (16) - same regional order
 * 60-67. Sweet 16 picks (8) - same regional order
 * 68-71. Elite 8 picks (4) - same regional order
 * 72-73. Final Four picks (2) - left, right
 * 74. Champion
 * 75. Tie Breaker
 * 
 * Sorting: Submitted → In Progress → Deleted
 * 
 * Query parameters (optional filters):
 * - userId: Filter by user ID
 * - year: Filter by year
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const filterUserId = searchParams.get('userId');
    const filterYear = searchParams.get('year');
    
    let brackets = await getAllBrackets();
    
    // Apply filters (user and year only - export ALL statuses)
    if (filterUserId && filterUserId !== 'all') {
      brackets = brackets.filter(b => b.userId === filterUserId);
    }
    if (filterYear && filterYear !== 'all') {
      const yearNum = parseInt(filterYear);
      if (!isNaN(yearNum)) {
        brackets = brackets.filter(b => b.year === yearNum);
      }
    }
    
    // Sort by status: submitted first, then in_progress, then deleted
    const statusOrder: Record<string, number> = {
      'submitted': 1,
      'in_progress': 2,
      'deleted': 3
    };
    brackets.sort((a, b) => {
      const orderA = statusOrder[a.status] || 99;
      const orderB = statusOrder[b.status] || 99;
      return orderA - orderB;
    });
    
    // Get team reference data for abbreviation mapping
    const teamData = await getAllTeamReferenceData(false);
    const teamIdToAbbr = new Map<string, string>();
    Object.entries(teamData).forEach(([abbr, teamInfo]) => {
      teamIdToAbbr.set(teamInfo.id, abbr);
    });
    
    // Generate game IDs in the correct order
    // Regional order: Top Left, Bottom Left, Top Right, Bottom Right
    const regions = ['Top Left', 'Bottom Left', 'Top Right', 'Bottom Right'];
    
    // Round of 64: 8 games per region (32 total)
    const round1GameIds: string[] = [];
    regions.forEach(region => {
      for (let i = 1; i <= 8; i++) {
        round1GameIds.push(`${region}-r64-${i}`);
      }
    });
    
    // Round of 32: 4 games per region (16 total)
    const round2GameIds: string[] = [];
    regions.forEach(region => {
      for (let i = 1; i <= 4; i++) {
        round2GameIds.push(`${region}-r32-${i}`);
      }
    });
    
    // Sweet 16: 2 games per region (8 total)
    const sweet16GameIds: string[] = [];
    regions.forEach(region => {
      for (let i = 1; i <= 2; i++) {
        sweet16GameIds.push(`${region}-s16-${i}`);
      }
    });
    
    // Elite 8: 1 game per region (4 total)
    const elite8GameIds: string[] = [];
    regions.forEach(region => {
      elite8GameIds.push(`${region}-e8-1`);
    });
    
    // Final Four: 2 games (left and right semifinal)
    // Championship: 1 game
    
    /**
     * Get team abbreviation from team ID
     */
    const getTeamAbbr = (teamId: string | undefined): string => {
      if (!teamId) return '';
      return teamIdToAbbr.get(teamId) || '';
    };
    
    
    /**
     * Format timestamp for CSV
     */
    const formatTimestamp = (date: Date | string | undefined | null): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toISOString();
    };
    
    // Build CSV header (74 columns)
    const headers = [
      'Bracket ID',
      'UUID',
      'Status',
      'Source',
      'Entry Name',
      'Player Name',
      'Player Name',
      'Player Email',
      'Updated Timestamp',
      'Submitted Timestamp',
      'Entry Name',
      // 32 Round 1 picks
      ...round1GameIds.map((_, i) => `R1-${i + 1}`),
      // 16 Round 2 picks
      ...round2GameIds.map((_, i) => `R2-${i + 1}`),
      // 8 Sweet 16 picks
      ...sweet16GameIds.map((_, i) => `S16-${i + 1}`),
      // 4 Elite 8 picks
      ...elite8GameIds.map((_, i) => `E8-${i + 1}`),
      // 2 Final Four picks
      'FF-1',
      'FF-2',
      // Champion
      'Champion',
      // Tie Breaker
      'Tie Breaker'
    ];
    
    // Build CSV rows
    const rows = brackets.map(bracket => {
      const picks = bracket.picks || {};
      
      // Generate friendly bracket ID (YYYY-NNNNNN)
      const friendlyId = `${bracket.year || new Date().getFullYear()}-${String(bracket.bracketNumber || 0).padStart(6, '0')}`;
      
      // Get picks for each round
      const round1Picks = round1GameIds.map(id => getTeamAbbr(picks[id]));
      const round2Picks = round2GameIds.map(id => getTeamAbbr(picks[id]));
      const sweet16Picks = sweet16GameIds.map(id => getTeamAbbr(picks[id]));
      const elite8Picks = elite8GameIds.map(id => getTeamAbbr(picks[id]));
      const finalFour1 = getTeamAbbr(picks['final-four-1']);
      const finalFour2 = getTeamAbbr(picks['final-four-2']);
      const champion = getTeamAbbr(picks['championship']);
      
      // Submitted timestamp from `submitted_at` (not last edit time)
      const submittedTimestamp =
        bracket.status === 'submitted' ? formatTimestamp(bracket.submittedAt ?? null) : '';
      
      return [
        escapeCsvCell(friendlyId),
        escapeCsvCell(bracket.id),
        escapeCsvCell(bracket.status),
        escapeCsvCell(bracket.source || 'site'),
        escapeCsvCell(bracket.entryName),
        escapeCsvCell(bracket.userName),
        escapeCsvCell(bracket.userName), // Duplicate
        escapeCsvCell(bracket.userEmail),
        escapeCsvCell(formatTimestamp(bracket.updatedAt)),
        escapeCsvCell(submittedTimestamp),
        escapeCsvCell(bracket.entryName), // Duplicate
        ...round1Picks.map(escapeCsvCell),
        ...round2Picks.map(escapeCsvCell),
        ...sweet16Picks.map(escapeCsvCell),
        ...elite8Picks.map(escapeCsvCell),
        escapeCsvCell(finalFour1),
        escapeCsvCell(finalFour2),
        escapeCsvCell(champion),
        escapeCsvCell(bracket.tieBreaker)
      ];
    });
    
    // Combine header and rows into CSV
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ];
    const csvText = csvLines.join('\n');
    const bytes = encodeCsvUtf8WithBom(csvText);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `brackets-export-${timestamp}.csv`;

    // Copy into Buffer so BodyInit / BlobPart typing matches (Uint8Array<ArrayBufferLike> can fail strict checks).
    return new NextResponse(Buffer.from(bytes), {
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
