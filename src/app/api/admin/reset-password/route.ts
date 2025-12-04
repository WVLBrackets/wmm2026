import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/reset-password - Reset password for a user by email
 * Used by the /admin/reset-password page
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const environment = getCurrentEnvironment();

    // Find user by email
    const userResult = await sql`
      SELECT id, email FROM users 
      WHERE email = ${email} AND environment = ${environment}
    `;

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password, set as confirmed, and clear any tokens
    await sql`
      UPDATE users 
      SET password = ${hashedPassword},
          email_confirmed = TRUE,
          confirmation_token = NULL, 
          confirmation_expires = NULL,
          reset_token = NULL,
          reset_expires = NULL
      WHERE id = ${userId} AND environment = ${environment}
    `;

    // Delete any confirmation or reset tokens for this user
    await sql`
      DELETE FROM tokens 
      WHERE user_id = ${userId} AND environment = ${environment}
    `;

    return NextResponse.json({
      message: `Password reset successfully for ${email}. User can now sign in with the new password.`,
    });

  } catch (error) {
    console.error('Admin password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
