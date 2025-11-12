import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import { UsageLogEntry } from '@/lib/usageLogger';
import crypto from 'crypto';

/**
 * POST /api/log/usage - Batch log usage events
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
    const { entries } = body as { entries: UsageLogEntry[] };

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid entries array' },
        { status: 400 }
      );
    }

    // Map environment to display format
    const envDisplay = environment === 'production' ? 'Prod' : 'Preview';

    // Insert all entries in a single transaction
    const values = entries.map((entry) => {
      const id = crypto.randomUUID();
      return sql`
        INSERT INTO usage_logs (
          id, environment, timestamp, is_logged_in, username,
          event_type, location, bracket_id, user_agent
        ) VALUES (
          ${id},
          ${environment},
          ${entry.timestamp},
          ${isLoggedIn},
          ${username},
          ${entry.eventType},
          ${entry.location},
          ${entry.bracketId || null},
          ${userAgent}
        )
      `;
    });

    // Execute all inserts
    await Promise.all(values);

    return NextResponse.json({
      success: true,
      logged: entries.length,
    });
  } catch (error) {
    console.error('Error logging usage:', error);
    // Don't fail the request - logging should be fire-and-forget
    return NextResponse.json(
      { success: false, error: 'Failed to log usage' },
      { status: 500 }
    );
  }
}

