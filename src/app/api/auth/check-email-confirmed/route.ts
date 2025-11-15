import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/secureDatabase';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.json({
        exists: false,
        confirmed: false,
      });
    }

    return NextResponse.json({
      exists: true,
      confirmed: user.emailConfirmed || false,
    });
  } catch (error) {
    console.error('Error checking email confirmation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

