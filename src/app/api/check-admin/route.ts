import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';

/**
 * GET /api/check-admin - Check if current authenticated user is an admin
 * SECURITY: Requires authentication - returns 401 if not authenticated
 * This endpoint is used by client-side code to check admin status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Require authentication - don't reveal admin status to unauthenticated users
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userIsAdmin = await isAdmin(session.user.email);

    return NextResponse.json({ isAdmin: userIsAdmin });
  } catch (error) {
    // Don't expose error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        ...(isDevelopment && { details: error instanceof Error ? error.message : 'Unknown error' })
      },
      { status: 500 }
    );
  }
}

