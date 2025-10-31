import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';

/**
 * DEBUG endpoint to check users across all environments
 * GET /api/debug-all-environments - List users from preview and production
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

    // Query users from both preview and production environments
    const previewUsersResult = await sql`
      SELECT id, email, name, email_confirmed, created_at, last_login, environment
      FROM users 
      WHERE environment = 'preview'
      ORDER BY created_at DESC
    `;
    
    const productionUsersResult = await sql`
      SELECT id, email, name, email_confirmed, created_at, last_login, environment
      FROM users 
      WHERE environment = 'production'
      ORDER BY created_at DESC
    `;

    const previewUsers = previewUsersResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      emailConfirmed: row.email_confirmed as boolean,
      createdAt: row.created_at as string,
      lastLogin: row.last_login ? new Date(row.last_login as string).toISOString() : null,
      environment: row.environment as string,
    }));

    const productionUsers = productionUsersResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      email: row.email as string,
      name: row.name as string,
      emailConfirmed: row.email_confirmed as boolean,
      createdAt: row.created_at as string,
      lastLogin: row.last_login ? new Date(row.last_login as string).toISOString() : null,
      environment: row.environment as string,
    }));

    return NextResponse.json({
      success: true,
      preview: {
        count: previewUsers.length,
        users: previewUsers.map(u => ({
          name: u.name,
          email: u.email,
          emailConfirmed: u.emailConfirmed,
          createdAt: u.createdAt,
          lastLogin: u.lastLogin,
        })),
      },
      production: {
        count: productionUsers.length,
        users: productionUsers.map(u => ({
          name: u.name,
          email: u.email,
          emailConfirmed: u.emailConfirmed,
          createdAt: u.createdAt,
          lastLogin: u.lastLogin,
        })),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error getting users from all environments:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get users',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

