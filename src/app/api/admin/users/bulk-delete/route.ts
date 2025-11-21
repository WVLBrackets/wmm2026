import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@vercel/postgres';
import { getCurrentEnvironment, getUserBracketCounts } from '@/lib/secureDatabase';

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

    // Process each user
    for (const userId of userIds) {
      try {
        // Check if user has any brackets
        const bracketCounts = await getUserBracketCounts(userId);
        
        if (bracketCounts.submitted > 0 || bracketCounts.inProgress > 0 || bracketCounts.deleted > 0) {
          skippedIds.push(userId);
          continue;
        }

        // Delete tokens first (foreign key constraint)
        await sql`
          DELETE FROM tokens 
          WHERE user_id = ${userId} AND environment = ${environment}
        `;

        // Delete user
        const result = await sql`
          DELETE FROM users 
          WHERE id = ${userId} AND environment = ${environment}
        `;

        if ((result.rowCount ?? 0) > 0) {
          deletedIds.push(userId);
        }
      } catch (error) {
        console.error(`Error deleting user ${userId}:`, error);
        // Continue with next user
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedIds.length,
      skipped: skippedIds.length,
      deletedIds,
      skippedIds,
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk delete users' },
      { status: 500 }
    );
  }
}

