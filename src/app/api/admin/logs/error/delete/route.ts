import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * DELETE /api/admin/logs/error/delete - Delete error logs (admin only)
<<<<<<< HEAD
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
=======
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
>>>>>>> security
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
    const date = searchParams.get('date');

<<<<<<< HEAD
    let result;
    if (date) {
      // Delete logs for a specific date
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      
      result = await sql`
        DELETE FROM error_logs
        WHERE environment = ${environment}
          AND timestamp >= ${dateStart.toISOString()}
          AND timestamp <= ${dateEnd.toISOString()}
      `;
    } else {
      // Delete all logs for the environment (should not happen, but handle it)
      result = await sql`
        DELETE FROM error_logs
        WHERE environment = ${environment}
      `;
    }

=======
    // SECURITY: Require date parameter to prevent accidental deletion of all logs
    if (!date) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Date parameter is required for safety'
        },
        { status: 400 }
      );
    }

    // Delete logs for a specific date
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);
    
    const result = await sql`
      DELETE FROM error_logs
      WHERE environment = ${environment}
        AND timestamp >= ${dateStart.toISOString()}
        AND timestamp <= ${dateEnd.toISOString()}
    `;

>>>>>>> security
    return NextResponse.json({
      success: true,
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    console.error('Error deleting error logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete error logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

