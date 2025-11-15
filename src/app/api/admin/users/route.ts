import { NextResponse } from 'next/server';
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
    
    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        count: 0
      });
    }
    
    // Get bracket counts for each user and map field names
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        try {
          const bracketCounts = await getUserBracketCounts(user.id);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailConfirmed: user.emailConfirmed,
          createdAt: user.createdAt.toISOString(),
          lastLogin: user.lastLogin instanceof Date ? user.lastLogin.toISOString() : null,
          bracketCounts,
        };
        } catch (error) {
          // Log error but don't expose user IDs in production
          // Always return generic error for security
          if (false) {
            console.error(`[Admin Users API] Error getting bracket counts for user ${user.id}:`, error);
          } else {
            console.error('[Admin Users API] Error getting bracket counts for user');
          }
          // Return user without bracket counts if query fails
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            emailConfirmed: user.emailConfirmed,
            createdAt: user.createdAt.toISOString(),
            lastLogin: user.lastLogin instanceof Date ? user.lastLogin.toISOString() : null,
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
