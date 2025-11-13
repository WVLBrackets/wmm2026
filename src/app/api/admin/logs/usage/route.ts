import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/usage - Get usage logs (admin only)
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
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const environment = searchParams.get('environment') || getCurrentEnvironment();
    const username = searchParams.get('username');
    const eventType = searchParams.get('eventType');
    const location = searchParams.get('location');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date range filtering
    // Client now sends UTC ISO strings, so we can use them directly
    const startDateISO = startDate || null;
    const endDateISO = endDate || null;
    
    // Build WHERE conditions dynamically
    const conditions: string[] = [`environment = '${environment}'`];
    const params: any[] = [];
    
    if (startDateISO) {
      conditions.push(`timestamp >= '${startDateISO}'`);
    }
    if (endDateISO) {
      conditions.push(`timestamp <= '${endDateISO}'`);
    }
    if (username) {
      conditions.push(`username = '${username.replace(/'/g, "''")}'`);
    }
    if (eventType) {
      conditions.push(`event_type = '${eventType.replace(/'/g, "''")}'`);
    }
    if (location) {
      conditions.push(`location ILIKE '%${location.replace(/'/g, "''")}%'`);
    }
    
    const whereClause = conditions.join(' AND ');
    
    const result = await sql`
      SELECT 
        id, environment, timestamp, is_logged_in, username,
        event_type, location, bracket_id, user_agent, created_at
      FROM usage_logs
      WHERE ${sql.raw(whereClause)}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Map environment to display format
    interface UsageLogRow {
      id: string;
      environment: string;
      timestamp: string;
      is_logged_in: boolean;
      username: string | null;
      event_type: string;
      location: string;
      bracket_id: string | null;
      user_agent: string | null;
      created_at: string;
    }
    const logs = result.rows.map((row: UsageLogRow) => ({
      id: row.id,
      environment: row.environment === 'production' ? 'Prod' : 'Preview',
      timestamp: row.timestamp,
      isLoggedIn: row.is_logged_in,
      username: row.username,
      eventType: row.event_type,
      location: row.location,
      bracketId: row.bracket_id,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch usage logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

