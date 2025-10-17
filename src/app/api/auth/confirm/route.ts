import { NextRequest, NextResponse } from 'next/server';
import { confirmUserEmail } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    const confirmed = await confirmUserEmail(token);
    
    if (!confirmed) {
      return NextResponse.json(
        { error: 'Invalid or expired confirmation token' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Email confirmed successfully. You can now sign in.',
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

