import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllUsers, getBracketCountsGroupedByUser } from '@/lib/repositories/userRepository';

/**
 * GET /api/admin/users - Get all users with bracket counts (admin only)
 */
export async function GET() {
  try {
    // Check if user is admin
    await requireAdmin();
    
    // Get all users (without passwords)
    const users = await getAllUsers();
    
    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        count: 0
      });
    }

    const emptyCounts = { submitted: 0, inProgress: 0, deleted: 0 } as const;
    let countsByUser: Map<string, { submitted: number; inProgress: number; deleted: number }>;
    try {
      countsByUser = await getBracketCountsGroupedByUser();
    } catch (error) {
      console.error('[Admin Users API] Error loading grouped bracket counts:', error);
      countsByUser = new Map();
    }

    const usersWithCounts = users.map((user) => {
      const bracketCounts = countsByUser.get(user.id) ?? emptyCounts;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailConfirmed: user.emailConfirmed,
        createdAt: user.createdAt.toISOString(),
        lastLogin: user.lastLogin instanceof Date ? user.lastLogin.toISOString() : null,
        bracketCounts,
      };
    });
    
    return NextResponse.json({
      success: true,
      users: usersWithCounts,
      count: usersWithCounts.length
    });
  } catch (error) {
    // Don't expose error details in production
    // Always return generic error for security
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin Users API] Error:', errorMessage);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch users',
      },
      { status: 500 }
    );
  }
}
