import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * DEBUG endpoint to delete a user by email
 * DELETE /api/debug-delete-user?email=user@example.com
 * This is a temporary endpoint for one-off user deletion
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const environment = getCurrentEnvironment();
    
    console.log(`[debug-delete-user] Attempting to delete user ${email} from ${environment} environment`);
    
    // First check if user exists
    const checkResult = await sql`
      SELECT id, email, name, environment 
      FROM users 
      WHERE email = ${email} AND environment = ${environment}
    `;
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `User with email ${email} not found in ${environment} environment`,
      }, { status: 404 });
    }
    
    const user = checkResult.rows[0];
    const userId = user.id as string;
    
    // Delete associated tokens first
    await sql`
      DELETE FROM tokens 
      WHERE user_id = ${userId} AND environment = ${environment}
    `;
    
    // Delete associated brackets
    await sql`
      DELETE FROM brackets 
      WHERE user_id = ${userId} AND environment = ${environment}
    `;
    
    // Delete the user
    const deleteResult = await sql`
      DELETE FROM users 
      WHERE id = ${userId} AND environment = ${environment}
    `;
    
    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      console.log(`[debug-delete-user] Successfully deleted user ${email} (${userId}) from ${environment}`);
      return NextResponse.json({
        success: true,
        message: `User ${email} deleted successfully from ${environment} environment`,
        deletedUser: {
          id: userId,
          email: user.email,
          name: user.name,
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'User deletion did not affect any rows',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[debug-delete-user] Error deleting user:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

