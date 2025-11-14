import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAllBrackets } from '@/lib/secureDatabase';

/**
 * GET /api/admin/brackets - Get all brackets (admin only)
 */
export async function GET() {
  try {
    // Check if user is admin
    await requireAdmin();
    
    // Get all brackets with user information
    const brackets = await getAllBrackets();
    
    return NextResponse.json({
      success: true,
      data: brackets,
      count: brackets.length
    });
  } catch (error) {
    console.error('Admin brackets error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch brackets' },
      { status: 500 }
    );
  }
}
