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
    
    // Build query with all possible filter combinations
    let result;
    
    // Check which filters are active
    const hasDateRange = startDateISO && endDateISO;
    const hasStartDate = startDateISO && !endDateISO;
    const hasEndDate = endDateISO && !startDateISO;
    const hasUsername = !!username;
    const hasEventType = !!eventType;
    const hasLocation = !!location;
    
    // Build query based on filter combinations
    if (hasUsername && hasEventType && hasLocation && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEventType && hasLocation && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEventType && hasLocation && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEventType && hasLocation) {
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
    } else if (hasUsername && hasEventType && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEventType && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEventType && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND event_type = ${eventType}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEventType) {
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
    } else if (hasUsername && hasLocation && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasLocation && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasLocation && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasLocation) {
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
    } else if (hasUsername && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasUsername) {
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
    } else if (hasEventType && hasLocation && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasEventType && hasLocation && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasEventType && hasLocation && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasEventType && hasLocation) {
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
    } else if (hasEventType && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasEventType && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasEventType && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND event_type = ${eventType}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasEventType) {
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
    } else if (hasLocation && hasDateRange) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasLocation && hasStartDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp >= ${startDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasLocation && hasEndDate) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent, created_at
        FROM usage_logs
        WHERE environment = ${environment}
          AND location ILIKE ${'%' + location + '%'}
          AND timestamp <= ${endDateISO}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (hasLocation) {
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
    } else if (hasDateRange) {
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
    } else if (hasStartDate) {
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
    } else if (hasEndDate) {
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

