import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { Pool } from 'pg';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * POST /api/admin/users/bulk-delete - Bulk delete users (admin only)
 * Skips users that have bracket counts
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User IDs array is required' },
        { status: 400 }
      );
    }

    const environment = getCurrentEnvironment();
    const deletedIds: string[] = [];
    const skippedIds: string[] = [];

    // Use pg Pool for dynamic queries with arrays
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    
    const pool = new Pool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false },
    });

    try {
      // Batch check bracket counts for all users at once
      // Build IN clause with individual parameters for each user ID
      const userIdPlaceholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
      const bracketCountsQuery = `
        SELECT 
          user_id,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
          SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) as deleted_count
        FROM brackets
        WHERE user_id IN (${userIdPlaceholders}) AND environment = $${userIds.length + 1}
        GROUP BY user_id
      `;
      const bracketCountsResult = await pool.query(bracketCountsQuery, [...userIds, environment]);

    // Create a map of userId -> bracket counts
    const bracketCountsMap = new Map<string, { submitted: number; inProgress: number; deleted: number }>();
    for (const row of bracketCountsResult.rows) {
      bracketCountsMap.set(row.user_id as string, {
        submitted: Number(row.submitted_count) || 0,
        inProgress: Number(row.in_progress_count) || 0,
        deleted: Number(row.deleted_count) || 0,
      });
    }

    // Separate users into deletable and skipped
    const deletableUserIds: string[] = [];
    for (const userId of userIds) {
      const counts = bracketCountsMap.get(userId) || { submitted: 0, inProgress: 0, deleted: 0 };
      if (counts.submitted > 0 || counts.inProgress > 0 || counts.deleted > 0) {
        skippedIds.push(userId);
      } else {
        deletableUserIds.push(userId);
      }
    }

      if (deletableUserIds.length > 0) {
        // Batch delete tokens first (foreign key constraint)
        const tokenDeletePlaceholders = deletableUserIds.map((_, i) => `$${i + 1}`).join(', ');
        const tokenDeleteQuery = `
          DELETE FROM tokens 
          WHERE user_id IN (${tokenDeletePlaceholders}) AND environment = $${deletableUserIds.length + 1}
        `;
        await pool.query(tokenDeleteQuery, [...deletableUserIds, environment]);

        // Batch delete users
        const userDeletePlaceholders = deletableUserIds.map((_, i) => `$${i + 1}`).join(', ');
        const userDeleteQuery = `
          DELETE FROM users 
          WHERE id IN (${userDeletePlaceholders}) AND environment = $${deletableUserIds.length + 1}
          RETURNING id
        `;
        const deleteResult = await pool.query(userDeleteQuery, [...deletableUserIds, environment]);

        deletedIds.push(...deleteResult.rows.map(row => row.id as string));
      }

      return NextResponse.json({
        success: true,
        deleted: deletedIds.length,
        skipped: skippedIds.length,
        deletedIds,
        skippedIds,
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk delete users' },
      { status: 500 }
    );
  }
}

