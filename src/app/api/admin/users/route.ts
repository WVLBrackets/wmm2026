import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllUsers, getUserBracketCounts } from '@/lib/secureDatabase';

/**
 * GET /api/admin/users - Get all users with bracket counts (admin only)
 */
export async function GET() {
  try {
    // Check if user is admin
    await requireAdmin();
    
    // Get all users (without passwords)
    const users = await getAllUsers();
    
    // Get bracket counts for each user and map field names
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        try {
          const bracketCounts = await getUserBracketCounts(user.id);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isConfirmed: user.emailConfirmed,
            createdAt: user.createdAt.toISOString(),
            bracketCounts,
          };
        } catch (error) {
          console.error(`Error getting bracket counts for user ${user.id}:`, error);
          // Return user without bracket counts if query fails
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isConfirmed: user.emailConfirmed,
            createdAt: user.createdAt.toISOString(),
            bracketCounts: { submitted: 0, inProgress: 0, deleted: 0 },
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      users: usersWithCounts,
      count: usersWithCounts.length
    });
  } catch (error) {
    console.error('Admin users error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
