import { NextRequest, NextResponse } from 'next/server';
import { confirmUserEmail } from '@/lib/secureDatabase';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    console.log('Confirmation API: Received token:', token);
    console.log('Confirmation API: Token length:', token ? token.length : 0);

    if (!token) {
      console.log('Confirmation API: No token provided');
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    console.log('Confirmation API: Calling confirmUserEmail...');
    const confirmed = await confirmUserEmail(token);
    console.log('Confirmation API: confirmUserEmail result:', confirmed);
    
    if (!confirmed) {
      console.log('Confirmation API: Token confirmation failed');
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

