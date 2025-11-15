import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
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

    // Build query with dynamic conditions
    let query = sql`
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
      WHERE environment = ${environment}
    `;

    // Add filters
    if (eventType && eventType !== 'all') {
      query = sql`${query} AND event_type = ${eventType}`;
    }
    if (destinationEmail) {
      query = sql`${query} AND destination_email ILIKE ${'%' + destinationEmail + '%'}`;
    }
    if (attachmentExpected !== null && attachmentExpected !== '') {
      const expected = attachmentExpected === 'true';
      query = sql`${query} AND attachment_expected = ${expected}`;
    }
    if (attachmentSuccess !== null && attachmentSuccess !== '') {
      if (attachmentSuccess === 'true') {
        query = sql`${query} AND attachment_success = true`;
      } else if (attachmentSuccess === 'false') {
        query = sql`${query} AND attachment_success = false`;
      } else if (attachmentSuccess === 'null') {
        query = sql`${query} AND attachment_success IS NULL`;
      }
    }
    if (emailSuccess !== null && emailSuccess !== '') {
      const success = emailSuccess === 'true';
      query = sql`${query} AND email_success = ${success}`;
    }
    if (startDate) {
      query = sql`${query} AND timestamp >= ${startDate}`;
    }
    if (endDate) {
      query = sql`${query} AND timestamp <= ${endDate}`;
    }

    // Add ordering and pagination
    query = sql`${query} ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await query;

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

    // Get total count for pagination
    let countQuery = sql`
      SELECT COUNT(*) as total
      FROM email_logs
      WHERE environment = ${environment}
    `;

    if (eventType && eventType !== 'all') {
      countQuery = sql`${countQuery} AND event_type = ${eventType}`;
    }
    if (destinationEmail) {
      countQuery = sql`${countQuery} AND destination_email ILIKE ${'%' + destinationEmail + '%'}`;
    }
    if (attachmentExpected !== null && attachmentExpected !== '') {
      const expected = attachmentExpected === 'true';
      countQuery = sql`${countQuery} AND attachment_expected = ${expected}`;
    }
    if (attachmentSuccess !== null && attachmentSuccess !== '') {
      if (attachmentSuccess === 'true') {
        countQuery = sql`${countQuery} AND attachment_success = true`;
      } else if (attachmentSuccess === 'false') {
        countQuery = sql`${countQuery} AND attachment_success = false`;
      } else if (attachmentSuccess === 'null') {
        countQuery = sql`${countQuery} AND attachment_success IS NULL`;
      }
    }
    if (emailSuccess !== null && emailSuccess !== '') {
      const success = emailSuccess === 'true';
      countQuery = sql`${countQuery} AND email_success = ${success}`;
    }
    if (startDate) {
      countQuery = sql`${countQuery} AND timestamp >= ${startDate}`;
    }
    if (endDate) {
      countQuery = sql`${countQuery} AND timestamp <= ${endDate}`;
    }

    const countResult = await countQuery;
    const total = countResult.rows[0]?.total ? Number(countResult.rows[0].total) : 0;

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      total,
      limit,
      offset,
    });
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

