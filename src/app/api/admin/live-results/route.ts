import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getUserByEmail, getUserById } from '@/lib/repositories/userRepository';
import { getOrCreateKeyBracket, acquireKeyBracketLock } from '@/lib/repositories/bracketRepository';

/**
 * POST /api/admin/live-results
 * Open a live-results session for a given year:
 * - Ensures KEY bracket exists
 * - Acquires editing lock
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const adminUser = await getUserByEmail(session.user.email);
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Admin user record not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsedYear = Number(body?.year);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 9999) {
      return NextResponse.json(
        { success: false, error: 'Invalid year provided' },
        { status: 400 }
      );
    }

    const keyBracket = await getOrCreateKeyBracket(parsedYear, adminUser.id);
    const lockResult = await acquireKeyBracketLock(keyBracket.id, adminUser.id);

    if (!lockResult.acquired) {
      let lockedByName: string | undefined;
      if (lockResult.lockedByUserId) {
        const lockUser = await getUserById(lockResult.lockedByUserId);
        lockedByName = lockUser?.name || lockUser?.email || undefined;
      }
      return NextResponse.json(
        {
          success: false,
          error: lockedByName
            ? `Live Results is currently being edited by ${lockedByName}`
            : 'Live Results is currently being edited by another admin',
        },
        { status: 409 }
      );
    }

    const isFirstOpen = keyBracket.status === 'draft';

    return NextResponse.json({
      success: true,
      data: {
        bracketId: keyBracket.id,
        year: keyBracket.year,
        isFirstOpen,
      },
    });
  } catch (error) {
    console.error('Error opening Live Results session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to open Live Results session' },
      { status: 500 }
    );
  }
}
