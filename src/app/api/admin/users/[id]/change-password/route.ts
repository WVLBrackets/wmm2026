import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import bcrypt from 'bcryptjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const environment = getCurrentEnvironment();

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password, set as confirmed, and clear any confirmation tokens
    await sql`
      UPDATE users 
      SET password = ${hashedPassword},
          email_confirmed = TRUE,
          confirmation_token = NULL, 
          confirmation_expires = NULL,
          reset_token = NULL,
          reset_expires = NULL
      WHERE id = ${id} AND environment = ${environment}
    `;

    // Delete any confirmation or reset tokens for this user
    await sql`
      DELETE FROM tokens 
      WHERE user_id = ${id} AND environment = ${environment}
    `;

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. User is now confirmed and can login.',
    });
  } catch (error) {
    console.error('Error changing password (admin):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change password' },
      { status: 500 }
    );
  }
}

