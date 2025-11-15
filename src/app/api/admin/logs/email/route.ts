import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { Pool } from 'pg';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * GET /api/admin/logs/email - Get email logs (admin only)
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
    const eventType = searchParams.get('eventType');
    const destinationEmail = searchParams.get('destinationEmail');
    const attachmentExpected = searchParams.get('attachmentExpected');
    const attachmentSuccess = searchParams.get('attachmentSuccess');
    const emailSuccess = searchParams.get('emailSuccess');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query conditions array
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Always filter by environment
    conditions.push(`environment = $${paramIndex}`);
    params.push(environment);
    paramIndex++;

    // Add filters
    if (eventType && eventType !== 'all') {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }
    if (destinationEmail) {
      conditions.push(`destination_email ILIKE $${paramIndex}`);
      params.push(`%${destinationEmail}%`);
      paramIndex++;
    }
    if (attachmentExpected !== null && attachmentExpected !== '') {
      conditions.push(`attachment_expected = $${paramIndex}`);
      params.push(attachmentExpected === 'true');
      paramIndex++;
    }
    if (attachmentSuccess !== null && attachmentSuccess !== '') {
      if (attachmentSuccess === 'true') {
        conditions.push(`attachment_success = $${paramIndex}`);
        params.push(true);
        paramIndex++;
      } else if (attachmentSuccess === 'false') {
        conditions.push(`attachment_success = $${paramIndex}`);
        params.push(false);
        paramIndex++;
      } else if (attachmentSuccess === 'null') {
        conditions.push(`attachment_success IS NULL`);
      }
    }
    if (emailSuccess !== null && emailSuccess !== '') {
      conditions.push(`email_success = $${paramIndex}`);
      params.push(emailSuccess === 'true');
      paramIndex++;
    }
    if (startDate) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    // Build the WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build and execute query using pg Pool for dynamic queries
    const queryText = `
      SELECT 
        id,
        environment,
        timestamp,
        event_type,
        destination_email,
        attachment_expected,
        attachment_success,
        email_success,
        created_at
      FROM email_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    // Use pg Pool for dynamic queries
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    
    const pool = new Pool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false },
    });
    
    try {
      const result = await pool.query(queryText, params);

      interface EmailLogRow {
        id: string;
        environment: string;
        timestamp: Date;
        event_type: string;
        destination_email: string;
        attachment_expected: boolean;
        attachment_success: boolean | null;
        email_success: boolean;
        created_at: Date;
      }

      const logs = (result.rows || []).map((row: EmailLogRow) => ({
        id: row.id,
        environment: row.environment,
        timestamp: row.timestamp,
        eventType: row.event_type,
        destinationEmail: row.destination_email,
        attachmentExpected: row.attachment_expected,
        attachmentSuccess: row.attachment_success,
        emailSuccess: row.email_success,
        createdAt: row.created_at,
      }));

      // Get total count for pagination (reuse same conditions)
      const countQueryText = `
        SELECT COUNT(*) as total
        FROM email_logs
        ${whereClause}
      `;
      // Remove limit and offset from params for count query
      const countParams = params.slice(0, -2);
      
      const countResult = await pool.query(countQueryText, countParams);
      const total = countResult.rows[0]?.total ? Number(countResult.rows[0].total) : 0;

      return NextResponse.json({
        success: true,
        logs,
        count: logs.length,
        total,
        limit,
        offset,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch email logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

