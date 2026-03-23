import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getBracketById, getBracketsByUserId, updateBracket, deleteBracket } from '@/lib/repositories/bracketRepository';
import { normalizeStoredDisplayName } from '@/lib/stringNormalize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    const adminCheck = session?.user?.email ? await isAdmin(session.user.email) : false;

    if (!session?.user?.email || !adminCheck) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    const bracket = await getBracketById(id);

    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: bracket,
    });
  } catch (error) {
    console.error('Error fetching bracket (admin):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bracket' },
      { status: 500 }
    );
  }
}

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

    const existing = await getBracketById(id);
    if (existing?.isKey) {
      return NextResponse.json(
        { success: false, error: 'Use Live Results tab to edit the KEY bracket' },
        { status: 400 }
      );
    }
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    const nextEntryName =
      typeof body.entryName === 'string'
        ? normalizeStoredDisplayName(body.entryName)
        : existing.entryName;
    const nextStatus = typeof body.status === 'string' ? body.status : existing.status;
    const nextUserId = typeof body.userId === 'string' ? body.userId : existing.userId;

    if (nextStatus === 'submitted') {
      const userBrackets = await getBracketsByUserId(nextUserId);
      const hasDuplicateSubmittedName = userBrackets.some((bracket) =>
        bracket.id !== id &&
        bracket.status === 'submitted' &&
        bracket.year === existing.year &&
        bracket.entryName.toLowerCase() === nextEntryName.toLowerCase()
      );

      if (hasDuplicateSubmittedName) {
        return NextResponse.json(
          {
            success: false,
            error: `Rename failed: user already has a submitted bracket named "${nextEntryName}" for ${existing.year}.`,
          },
          { status: 409 }
        );
      }
    }

    const updatedBracket = await updateBracket(id, {
      entryName: nextEntryName,
      tieBreaker: body.tieBreaker,
      picks: body.picks,
      status: nextStatus,
      userId: nextUserId,
    });

    if (!updatedBracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found or failed to update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedBracket,
      message: 'Bracket updated successfully',
    });
  } catch (error) {
    console.error('Error updating bracket (admin):', error);
    const maybeCode = (error as { code?: string })?.code;
    const maybeMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      maybeCode === '23505' ||
      maybeMessage.includes('idx_brackets_submitted_unique_entry_name_per_user_year_env')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rename failed: user already has a submitted bracket with that name for this year.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update bracket' },
      { status: 500 }
    );
  }
}

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

    const existing = await getBracketById(id);
    if (existing?.isKey) {
      return NextResponse.json(
        { success: false, error: 'KEY bracket cannot be deleted from Brackets tab' },
        { status: 400 }
      );
    }
    const deleted = await deleteBracket(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found or failed to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bracket deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting bracket (admin):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bracket' },
      { status: 500 }
    );
  }
}
