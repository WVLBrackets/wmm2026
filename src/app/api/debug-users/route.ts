import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getAllUsers, getUserBracketCounts } from '@/lib/secureDatabase';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * DEBUG endpoint to check users and database state
 * GET /api/debug-users - Diagnostic endpoint for user loading issues
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const environment = getCurrentEnvironment();
    
    // Get raw user count from database
    const userCountResult = await sql`
      SELECT COUNT(*) as count FROM users WHERE environment = ${environment}
    `;
    const userCount = parseInt(userCountResult.rows[0]?.count || '0');

    // Get raw user records
    const rawUsersResult = await sql`
      SELECT id, email, name, email_confirmed, created_at
      FROM users 
      WHERE environment = ${environment}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Try to get users via getAllUsers function
    let getAllUsersResult = null;
    let getAllUsersError = null;
    try {
      const users = await getAllUsers();
      getAllUsersResult = {
        count: users.length,
        sample: users.slice(0, 3).map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          emailConfirmed: u.emailConfirmed,
        }))
      };
    } catch (error) {
      getAllUsersError = error instanceof Error ? error.message : String(error);
    }

    // Try bracket counts for first user if exists
    let bracketCountsTest = null;
    if (rawUsersResult.rows.length > 0) {
      try {
        const firstUserId = rawUsersResult.rows[0].id as string;
        bracketCountsTest = await getUserBracketCounts(firstUserId);
      } catch (error) {
        bracketCountsTest = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return NextResponse.json({
      success: true,
      environment,
      diagnostics: {
        rawUserCount: userCount,
        rawUsersSample: rawUsersResult.rows.map(row => ({
          id: row.id,
          email: row.email,
          name: row.name,
          emailConfirmed: row.email_confirmed,
          createdAt: row.created_at,
        })),
        getAllUsersFunction: getAllUsersResult || { error: getAllUsersError },
        bracketCountsTest,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Debug Users] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Debug failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

