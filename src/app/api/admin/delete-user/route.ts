import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';

/**
 * TEMPORARY ENDPOINT - Delete a user by email
 * This is a one-time fix to resolve the stuck admin account issue
 * TODO: Remove this endpoint after the issue is resolved
 */
export async function POST(request: NextRequest) {
  try {
    const { email, confirmDelete } = await request.json();
    
    if (!email || !confirmDelete) {
      return NextResponse.json(
        { success: false, error: 'Email and confirmDelete required' },
        { status: 400 }
      );
    }
    
    // Delete user's tokens first (foreign key constraint)
    const tokensResult = await sql`
      DELETE FROM tokens WHERE user_id IN (
        SELECT id FROM users WHERE email = ${email}
      )
    `;
    
    // Delete user's brackets
    const bracketsResult = await sql`
      DELETE FROM brackets WHERE user_id IN (
        SELECT id FROM users WHERE email = ${email}
      )
    `;
    
    // Delete the user
    const userResult = await sql`
      DELETE FROM users WHERE email = ${email}
    `;
    
    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `User ${email} deleted successfully`,
      tokensDeleted: tokensResult.rowCount || 0,
      bracketsDeleted: bracketsResult.rowCount || 0,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

