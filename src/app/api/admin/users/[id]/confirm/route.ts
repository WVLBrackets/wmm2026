import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

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
    const environment = getCurrentEnvironment();

    // Update user to confirmed and clear confirmation tokens
    await sql`
      UPDATE users 
      SET email_confirmed = TRUE, 
          confirmation_token = NULL, 
          confirmation_expires = NULL
      WHERE id = ${id} AND environment = ${environment}
    `;

    // Delete any confirmation tokens for this user
    await sql`
      DELETE FROM tokens 
      WHERE user_id = ${id} AND type = 'confirmation' AND environment = ${environment}
    `;

    return NextResponse.json({
      success: true,
      message: 'User confirmed successfully',
    });
  } catch (error) {
    console.error('Error confirming user (admin):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm user' },
      { status: 500 }
    );
  }
}

