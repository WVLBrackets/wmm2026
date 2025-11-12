import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { ErrorLogEntry } from '@/lib/errorLogger';
import crypto from 'crypto';

/**
 * POST /api/log/error - Log an application error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const environment = getCurrentEnvironment();
    const userAgent = request.headers.get('user-agent') || '';

    // Get user info (optional - user may not be logged in)
    const isLoggedIn = !!session?.user?.email;
    const username = session?.user?.email || null;

    const body = await request.json();
    const { entry } = body as { entry: ErrorLogEntry };

    if (!entry || !entry.errorMessage) {
      return NextResponse.json(
        { success: false, error: 'Invalid error entry' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    await sql`
      INSERT INTO error_logs (
        id, environment, timestamp, is_logged_in, username,
        error_message, error_stack, error_type, location, user_agent
      ) VALUES (
        ${id},
        ${environment},
        ${entry.timestamp},
        ${isLoggedIn},
        ${username},
        ${entry.errorMessage},
        ${entry.errorStack || null},
        ${entry.errorType || null},
        ${entry.location || null},
        ${userAgent}
      )
    `;

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error logging error:', error);
    // Don't fail the request - error logging should be fire-and-forget
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 }
    );
  }
}

