import { NextRequest, NextResponse } from 'next/server';
import { Bracket } from '@/types/bracket';

// Mock storage - in production, this would be a database
let brackets: Bracket[] = [];

/**
 * GET /api/bracket/[id] - Get a specific bracket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bracket = brackets.find(b => b.id === params.id);
    
    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: bracket
    });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bracket' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bracket/[id] - Update a specific bracket
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    const bracketIndex = brackets.findIndex(b => b.id === params.id);
    
    if (bracketIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Update the bracket
    brackets[bracketIndex] = {
      ...brackets[bracketIndex],
      ...updates,
      id: params.id // Ensure ID doesn't change
    };

    return NextResponse.json({
      success: true,
      data: brackets[bracketIndex],
      message: 'Bracket updated successfully'
    });
  } catch (error) {
    console.error('Error updating bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bracket' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bracket/[id] - Delete a specific bracket
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bracketIndex = brackets.findIndex(b => b.id === params.id);
    
    if (bracketIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Remove the bracket
    brackets.splice(bracketIndex, 1);

    return NextResponse.json({
      success: true,
      message: 'Bracket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bracket' },
      { status: 500 }
    );
  }
}

