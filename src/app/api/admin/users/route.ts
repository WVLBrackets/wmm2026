import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllUsers, getUserBracketCounts } from '@/lib/secureDatabase';

/**
 * GET /api/admin/users - Get all users with bracket counts (admin only)
 */
export async function GET() {
  try {
    console.log('[Admin Users API] Starting request...');
    
    // Check if user is admin
    await requireAdmin();
    console.log('[Admin Users API] Admin check passed');
    
    // Get all users (without passwords)
    const users = await getAllUsers();
    console.log(`[Admin Users API] Found ${users.length} users in database`);
    
    if (users.length === 0) {
      console.log('[Admin Users API] No users found - returning empty array');
      return NextResponse.json({
        success: true,
        users: [],
        count: 0
      });
    }
    
    // Get bracket counts for each user and map field names
    console.log('[Admin Users API] Getting bracket counts for each user...');
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
          lastLogin: user.lastLogin instanceof Date ? user.lastLogin.toISOString() : null,
          bracketCounts,
        };
        } catch (error) {
          console.error(`[Admin Users API] Error getting bracket counts for user ${user.id}:`, error);
          // Return user without bracket counts if query fails
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isConfirmed: user.emailConfirmed,
            createdAt: user.createdAt.toISOString(),
            lastLogin: user.lastLogin instanceof Date ? user.lastLogin.toISOString() : null,
            bracketCounts: { submitted: 0, inProgress: 0, deleted: 0 },
          };
        }
      })
    );
    
    console.log(`[Admin Users API] Returning ${usersWithCounts.length} users with counts`);
    return NextResponse.json({
      success: true,
      users: usersWithCounts,
      count: usersWithCounts.length
    });
  } catch (error) {
    console.error('[Admin Users API] Error:', error);
    console.error('[Admin Users API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
