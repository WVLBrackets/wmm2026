import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/error - Get error logs (admin only)
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
    const errorType = searchParams.get('errorType');
    const location = searchParams.get('location');

    // Build query with dynamic conditions using template literals
    let result;
    if (username && errorType && location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND error_type = ${errorType}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (username && errorType) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND error_type = ${errorType}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (username && location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND username = ${username}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (errorType && location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND error_type = ${errorType}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (username) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND username = ${username}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (errorType) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND error_type = ${errorType}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (location) {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
          AND location ILIKE ${'%' + location + '%'}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT 
          id, environment, timestamp, is_logged_in, username,
          error_message, error_stack, error_type, location, user_agent, created_at
        FROM error_logs
        WHERE environment = ${environment}
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Map environment to display format
    const logs = result.rows.map((row: any) => ({
      id: row.id,
      environment: row.environment === 'production' ? 'Prod' : 'Preview',
      timestamp: row.timestamp,
      isLoggedIn: row.is_logged_in,
      username: row.username,
      errorMessage: row.error_message,
      errorStack: row.error_stack,
      errorType: row.error_type,
      location: row.location,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch error logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

