import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllUsers } from '@/lib/secureDatabase';

/**
 * GET /api/admin/users - Get all users (admin only)
 */
export async function GET() {
  try {
    // Check if user is admin
    await requireAdmin();
    
    // Get all users (without passwords)
    const users = await getAllUsers();
    
    return NextResponse.json({
      success: true,
      data: users,
      count: users.length
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
