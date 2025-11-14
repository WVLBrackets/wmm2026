import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/usage/summary - Get usage log summary for last 7 days grouped by day, event type, and location (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Admin access required'
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || getCurrentEnvironment();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Calculate last 7 days if no date range provided
    let startDateISO: string;
    let endDateISO: string;
    
    if (startDate && endDate) {
      startDateISO = startDate;
      endDateISO = endDate;
    } else {
      // Default to last 7 days
      const end = new Date();
      end.setHours(23, 59, 59, 999); // End of today
      const start = new Date(end);
      start.setDate(start.getDate() - 6); // 7 days ago (including today)
      start.setHours(0, 0, 0, 0); // Start of day
      
      startDateISO = start.toISOString();
      endDateISO = end.toISOString();
    }

    // Query for data grouped by day, event type, and location
    // Use PostgreSQL-compatible date extraction
    const result = await sql`
      SELECT 
        (timestamp::date)::text as date,
        event_type,
        location,
        COUNT(*) as count
      FROM usage_logs
      WHERE environment = ${environment}
        AND timestamp >= ${startDateISO}
        AND timestamp <= ${endDateISO}
      GROUP BY (timestamp::date), event_type, location
      ORDER BY (timestamp::date) DESC, event_type, location ASC
    `;

    interface SummaryRow {
      date: string;
      event_type: string;
      location: string;
      count: number;
    }

    const rows = (result.rows || []).map((row: SummaryRow) => ({
      date: row.date,
      eventType: row.event_type,
      location: row.location,
      count: Number(row.count),
    }));

    // Organize data by day
    const dataByDay: Record<string, { pageVisits: Record<string, number>; clicks: Record<string, number> }> = {};
    const locationTotals: Record<string, { pageVisits: number; clicks: number }> = {};
    let totalPageVisits = 0;
    let totalClicks = 0;

    rows.forEach((row) => {
      const dateKey = row.date;
      if (!dataByDay[dateKey]) {
        dataByDay[dateKey] = { pageVisits: {}, clicks: {} };
      }

      if (row.eventType === 'Page Visit') {
        dataByDay[dateKey].pageVisits[row.location] = (dataByDay[dateKey].pageVisits[row.location] || 0) + row.count;
        locationTotals[row.location] = locationTotals[row.location] || { pageVisits: 0, clicks: 0 };
        locationTotals[row.location].pageVisits += row.count;
        totalPageVisits += row.count;
      } else if (row.eventType === 'Click') {
        dataByDay[dateKey].clicks[row.location] = (dataByDay[dateKey].clicks[row.location] || 0) + row.count;
        locationTotals[row.location] = locationTotals[row.location] || { pageVisits: 0, clicks: 0 };
        locationTotals[row.location].clicks += row.count;
        totalClicks += row.count;
      }
    });

    // Get all unique locations
    const allLocations = Array.from(new Set(rows.map(r => r.location))).sort();

    // Generate array of last 7 days (or date range)
    const days: string[] = [];
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);
    const current = new Date(start);
    
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      days.push(dateKey);
      current.setDate(current.getDate() + 1);
    }

    // Build grid data
    const gridData = days.map(day => {
      const dayData = dataByDay[day] || { pageVisits: {}, clicks: {} };
      const dayPageVisits = Object.values(dayData.pageVisits).reduce((sum, count) => sum + count, 0);
      const dayClicks = Object.values(dayData.clicks).reduce((sum, count) => sum + count, 0);

      return {
        date: day,
        locations: allLocations.map(location => ({
          location,
          pageVisits: dayData.pageVisits[location] || 0,
          clicks: dayData.clicks[location] || 0,
        })),
        dayTotal: {
          pageVisits: dayPageVisits,
          clicks: dayClicks,
        },
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        gridData,
        locationTotals: Object.entries(locationTotals).map(([location, totals]) => ({
          location,
          pageVisits: totals.pageVisits,
          clicks: totals.clicks,
        })),
        totals: {
          pageVisits: totalPageVisits,
          clicks: totalClicks,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch usage summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

