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

    // Build query with dynamic conditions using template literals
    let result;
    if (username && eventType && location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (username && eventType) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (username && location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (eventType && location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (username) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (eventType) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      // Build date range filtering
      // datetime-local inputs are in local time, but database timestamps are in UTC
      // We need to convert the local datetime to UTC for proper comparison
      let startDateISO: string | null = null;
      let endDateISO: string | null = null;
      
      if (startDate) {
        // Parse the datetime-local string (format: YYYY-MM-DDTHH:mm)
        // Create a Date object treating it as local time, then convert to ISO (UTC)
        const localDate = new Date(startDate);
        startDateISO = localDate.toISOString();
      }
      
      if (endDate) {
        // For end date, we want to include the entire second, so add 999ms
        const localDate = new Date(endDate);
        localDate.setMilliseconds(999);
        endDateISO = localDate.toISOString();
      }
      
      if (startDate && endDate) {
        result = await sql`
          SELECT 
            id, environment, timestamp, is_logged_in, username,
            event_type, location, bracket_id, user_agent, created_at
          FROM usage_logs
          WHERE environment = ${environment}
            AND timestamp >= ${startDateISO}
            AND timestamp <= ${endDateISO}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (startDate) {
        result = await sql`
          SELECT 
            id, environment, timestamp, is_logged_in, username,
            event_type, location, bracket_id, user_agent, created_at
          FROM usage_logs
          WHERE environment = ${environment}
            AND timestamp >= ${startDateISO}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (endDate) {
        result = await sql`
          SELECT 
            id, environment, timestamp, is_logged_in, username,
            event_type, location, bracket_id, user_agent, created_at
          FROM usage_logs
          WHERE environment = ${environment}
            AND timestamp <= ${endDateISO}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        result = await sql`
          SELECT 
            id, environment, timestamp, is_logged_in, username,
            event_type, location, bracket_id, user_agent, created_at
          FROM usage_logs
          WHERE environment = ${environment}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

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

