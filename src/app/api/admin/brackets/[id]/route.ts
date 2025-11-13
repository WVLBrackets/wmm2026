import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { getBracketById, updateBracket, deleteBracket } from '@/lib/secureDatabase';

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

    const updatedBracket = await updateBracket(id, {
      entryName: body.entryName,
      tieBreaker: body.tieBreaker,
      picks: body.picks,
      status: body.status,
      userId: body.userId,
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
