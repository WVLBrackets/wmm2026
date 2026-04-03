import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/usage - Get usage logs (admin only).
 * Optional query params: limit, offset, environment, username, eventType, location (substring ILIKE),
 * bracketId (exact), startDate, endDate (ISO timestamps).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - Admin access required',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(10_000, Math.max(1, limitRaw)) : 100;
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const environment = searchParams.get('environment') || getCurrentEnvironment();
    const username = searchParams.get('username')?.trim() || null;
    const eventType = searchParams.get('eventType')?.trim() || null;
    const locationSubstr = searchParams.get('location')?.trim() || null;
    const bracketId = searchParams.get('bracketId')?.trim() || null;
    const startDate = searchParams.get('startDate')?.trim() || null;
    const endDate = searchParams.get('endDate')?.trim() || null;

    const locationPattern = locationSubstr ? `%${locationSubstr}%` : null;

    const result = await sql`
      SELECT
        id, environment, timestamp, is_logged_in, username,
        event_type, location, bracket_id, user_agent, created_at
      FROM usage_logs
      WHERE environment = ${environment}
        AND (${username}::text IS NULL OR username = ${username})
        AND (${eventType}::text IS NULL OR event_type = ${eventType})
        AND (${locationPattern}::text IS NULL OR location ILIKE ${locationPattern})
        AND (${bracketId}::text IS NULL OR bracket_id = ${bracketId})
        AND (${startDate}::text IS NULL OR timestamp >= ${startDate}::timestamptz)
        AND (${endDate}::text IS NULL OR timestamp <= ${endDate}::timestamptz)
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

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
      environment:
        row.environment === 'production'
          ? 'Prod'
          : row.environment === 'local'
            ? 'Local'
            : 'Preview',
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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
