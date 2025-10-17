import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/database';
import { sendConfirmationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email, name, password } = await request.json();

    // Basic validation
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Email, name, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Create user (this will generate a confirmation token)
    const user = await createUser(email, name, password);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    // In development mode or when email service is not configured, user is auto-confirmed
    const isDevelopment = process.env.NODE_ENV === 'development';
    const emailNotConfigured = !process.env.EMAIL_USER || !process.env.EMAIL_PASS;
    
    if (isDevelopment || emailNotConfigured) {
      return NextResponse.json({
        message: 'User created successfully. You can now sign in.',
        userId: user.id,
        autoConfirmed: true
      });
    }

    // In production with email service configured, send confirmation email
    const token = user.confirmationToken!;
    const confirmationLink = `${process.env.NEXTAUTH_URL}/auth/confirm?token=${token}`;
    
    const emailSent = await sendConfirmationEmail(email, name, confirmationLink, token);

    if (!emailSent) {
      console.warn('Failed to send confirmation email - account created but email failed');
      return NextResponse.json({
        message: 'User created successfully, but we could not send a confirmation email. Your account is ready to use.',
        userId: user.id,
        emailFailed: true
      });
    }

    return NextResponse.json({
      message: 'User created successfully. Please check your email to confirm your account.',
      userId: user.id,
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
