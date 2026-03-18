import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { getBracketById, updateBracket, releaseKeyBracketLock, deleteBracket } from '@/lib/repositories/bracketRepository';

/**
 * PUT /api/admin/live-results/[id]
 * Save KEY picks and tie-breaker, then release lock.
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

    const bracket = await getBracketById(id);
    if (!bracket || !bracket.isKey) {
      return NextResponse.json(
        { success: false, error: 'Live Results bracket not found' },
        { status: 404 }
      );
    }

    if (bracket.lockUserId && bracket.lockUserId !== adminUser.id) {
      return NextResponse.json(
        { success: false, error: 'This Live Results session is locked by another admin' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const updated = await updateBracket(id, {
      entryName: 'KEY',
      tieBreaker: body.tieBreaker,
      picks: body.picks,
      status: 'in_progress',
      lockUserId: null,
      lockAcquiredAt: null,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to save Live Results bracket' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error saving Live Results bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save Live Results bracket' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/live-results/[id]?action=cancel
 * Cancel live-results editing:
 * - If first-open (status draft), delete KEY bracket.
 * - Otherwise release lock.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const action = request.nextUrl.searchParams.get('action');
    if (action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'Unsupported action' },
        { status: 400 }
      );
    }

    const bracket = await getBracketById(id);
    if (!bracket || !bracket.isKey) {
      return NextResponse.json(
        { success: false, error: 'Live Results bracket not found' },
        { status: 404 }
      );
    }

    if (bracket.lockUserId && bracket.lockUserId !== adminUser.id) {
      return NextResponse.json(
        { success: false, error: 'This Live Results session is locked by another admin' },
        { status: 409 }
      );
    }

    // First open cancel behavior: remove unsaved KEY bracket entirely.
    if (bracket.status === 'draft') {
      const deleted = await deleteBracket(bracket.id);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: 'Failed to cancel initial Live Results session' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, deleted: true });
    }

    await releaseKeyBracketLock(bracket.id, adminUser.id);
    return NextResponse.json({ success: true, deleted: false });
  } catch (error) {
    console.error('Error cancelling Live Results editing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel Live Results editing' },
      { status: 500 }
    );
  }
}
