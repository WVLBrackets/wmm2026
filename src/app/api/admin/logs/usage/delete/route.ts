import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * DELETE /api/admin/logs/usage/delete - Delete usage logs (admin only)
 * 
 * SECURITY: This endpoint is protected by:
 * 1. Session authentication (getServerSession)
 * 2. Admin authorization (isAdmin check)
 * 3. Returns 403 if unauthorized
 * 4. Requires date parameter to prevent accidental deletion of all logs
 */
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Require authenticated session
    const session = await getServerSession(authOptions);
    
    // SECURITY: Require admin authorization
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
    const environment = searchParams.get('environment') || getCurrentEnvironment();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Delete logs - with date range if provided, otherwise delete all
    let result;
    if (startDate && endDate) {
      // Delete logs for the specified date range
      const startDateISO = new Date(startDate).toISOString();
      const endDateISO = new Date(endDate).toISOString();
      
      result = await sql`
        DELETE FROM usage_logs
        WHERE environment = ${environment}
          AND timestamp >= ${startDateISO}
          AND timestamp <= ${endDateISO}
      `;
    } else {
      // Delete all logs for the environment
      result = await sql`
        DELETE FROM usage_logs
        WHERE environment = ${environment}
      `;
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    console.error('Error deleting usage logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete usage logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
