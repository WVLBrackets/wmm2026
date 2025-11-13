import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/usage/summary - Get usage log summary grouped by event type and location (admin only)
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

    // Build date range filtering
    const startDateISO = startDate || null;
    const endDateISO = endDate || null;

    // Query for Page Visits summary
    let pageVisitsResult;
    if (startDateISO && endDateISO) {
      pageVisitsResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Page Visit'
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    } else if (startDateISO) {
      pageVisitsResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Page Visit'
          AND timestamp >= ${startDateISO}
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    } else if (endDateISO) {
      pageVisitsResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Page Visit'
          AND timestamp <= ${endDateISO}
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    } else {
      pageVisitsResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Page Visit'
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    }

    // Query for Clicks summary
    let clicksResult;
    if (startDateISO && endDateISO) {
      clicksResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Click'
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    } else if (startDateISO) {
      clicksResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Click'
          AND timestamp >= ${startDateISO}
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    } else if (endDateISO) {
      clicksResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Click'
          AND timestamp <= ${endDateISO}
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    } else {
      clicksResult = await sql`
        SELECT 
          location,
          COUNT(*) as count
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = 'Click'
        GROUP BY location
        ORDER BY count DESC, location ASC
      `;
    }

    // Map results
    interface SummaryRow {
      location: string;
      count: number;
    }

    const pageVisits = (pageVisitsResult.rows || []).map((row: SummaryRow) => ({
      location: row.location,
      count: Number(row.count),
    }));

    const clicks = (clicksResult.rows || []).map((row: SummaryRow) => ({
      location: row.location,
      count: Number(row.count),
    }));

    return NextResponse.json({
      success: true,
      summary: {
        pageVisits,
        clicks,
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

