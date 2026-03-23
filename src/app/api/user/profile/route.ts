import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUserByEmail,
  getUserSubmittedBracketStats,
  updateUserDisplayNameByEmail,
} from '@/lib/repositories/userRepository';
import { csrfProtection } from '@/lib/csrf';

/**
 * GET /api/user/profile — current user profile summary for My Picks modal (session required).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const stats = await getUserSubmittedBracketStats(user.id);

    return NextResponse.json({
      success: true,
      data: {
        email: user.email,
        displayName: user.name,
        createdAt: user.createdAt.toISOString(),
        tournamentsPlayed: stats.distinctSubmittedYears,
        bracketsEntered: stats.submittedCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/profile]', error);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

/**
 * PUT /api/user/profile — update display name only (session + CSRF).
 */
export async function PUT(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawName = body?.displayName ?? body?.name;
    if (typeof rawName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'displayName is required' },
        { status: 400 }
      );
    }

    let updated: { name: string } | null;
    try {
      updated = await updateUserDisplayNameByEmail(session.user.email, rawName);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid display name';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    if (!updated) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { displayName: updated.name },
    });
  } catch (error) {
    console.error('[PUT /api/user/profile]', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
