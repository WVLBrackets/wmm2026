import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { sql } from '@vercel/postgres';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * PUT /api/admin/users/[id] - Update user name and/or email (admin only)
 */
export async function PUT(
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

    const body = await request.json();
    const { name, email } = body;

    if (!name && !email) {
      return NextResponse.json(
        { success: false, error: 'Name or email must be provided' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const environment = getCurrentEnvironment();

    if (email) {
      // Check if email already exists (excluding current user)
      const existingUser = await sql`
        SELECT id FROM users 
        WHERE email = ${email} AND environment = ${environment} AND id != ${id}
      `;
      
      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Update user - build query based on what's provided
    let result;
    if (name && email) {
      result = await sql`
        UPDATE users 
        SET name = ${name}, email = ${email}
        WHERE id = ${id} AND environment = ${environment}
        RETURNING id, email, name, email_confirmed, created_at, last_login, environment
      `;
    } else if (name) {
      result = await sql`
        UPDATE users 
        SET name = ${name}
        WHERE id = ${id} AND environment = ${environment}
        RETURNING id, email, name, email_confirmed, created_at, last_login, environment
      `;
    } else if (email) {
      result = await sql`
        UPDATE users 
        SET email = ${email}
        WHERE id = ${id} AND environment = ${environment}
        RETURNING id, email, name, email_confirmed, created_at, last_login, environment
      `;
    } else {
      return NextResponse.json(
        { success: false, error: 'Name or email must be provided' },
        { status: 400 }
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = result.rows[0];
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailConfirmed: user.email_confirmed,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        environment: user.environment,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id] - Delete a user (admin only)
 * Only allows deletion if user has no brackets (submitted, in_progress, or deleted)
 */
export async function DELETE(
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

    const { deleteUser } = await import('@/lib/secureDatabase');
    const deleted = await deleteUser(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'User not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    if (error instanceof Error && error.message.includes('existing brackets')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
