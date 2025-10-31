import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !(await isAdmin(session.user.email))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }
  
  const environment = getCurrentEnvironment();
  try {
    const usersResult = await sql`SELECT COUNT(*) as count FROM users WHERE environment = ${environment}`;
    const tokensResult = await sql`SELECT COUNT(*) as count FROM tokens WHERE environment = ${environment}`;
    const bracketsResult = await sql`SELECT COUNT(*) as count FROM brackets WHERE environment = ${environment}`;

    return NextResponse.json({
      success: true,
      message: 'Database status',
      environment,
      usersCount: parseInt(usersResult.rows[0].count),
      tokensCount: parseInt(tokensResult.rows[0].count),
      bracketsCount: parseInt(bracketsResult.rows[0].count),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get database status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !(await isAdmin(session.user.email))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }
  
  const environment = getCurrentEnvironment();
  try {
    // Delete all data for the current environment
    await sql`DELETE FROM admin_actions WHERE environment = ${environment}`;
    await sql`DELETE FROM brackets WHERE environment = ${environment}`;
    await sql`DELETE FROM tokens WHERE environment = ${environment}`;
    await sql`DELETE FROM users WHERE environment = ${environment}`;

    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully',
      environment,
      usersCount: 0,
      tokensCount: 0,
      bracketsCount: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database clear error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear database',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
