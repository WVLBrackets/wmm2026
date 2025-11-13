import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * POST /api/admin/logs/cleanup - Clean up logs older than 60 days (admin only)
 */
export async function POST(request: NextRequest) {
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

    const environment = getCurrentEnvironment();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60); // 60 days ago

    // Delete usage logs older than 60 days
    const usageResult = await sql`
      DELETE FROM usage_logs
      WHERE environment = ${environment}
        AND timestamp < ${cutoffDate}
    `;

    // Delete error logs older than 60 days
    const errorResult = await sql`
      DELETE FROM error_logs
      WHERE environment = ${environment}
        AND timestamp < ${cutoffDate}
    `;

    return NextResponse.json({
      success: true,
      deletedUsageLogs: usageResult.rowCount || 0,
      deletedErrorLogs: errorResult.rowCount || 0,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cleanup logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

