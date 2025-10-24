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
    const bracketsResult = await sql`SELECT COUNT(*) as count FROM brackets WHERE environment = ${environment}`;

    return NextResponse.json({
      success: true,
      message: 'Brackets count',
      environment,
      bracketsCount: parseInt(bracketsResult.rows[0].count),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Brackets status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get brackets count',
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
    // Delete only brackets for the current environment (preserve users!)
    await sql`DELETE FROM admin_actions WHERE environment = ${environment}`;
    await sql`DELETE FROM brackets WHERE environment = ${environment}`;

    return NextResponse.json({
      success: true,
      message: 'Brackets cleared successfully (users preserved)',
      environment,
      bracketsCount: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Brackets clear error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear brackets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

