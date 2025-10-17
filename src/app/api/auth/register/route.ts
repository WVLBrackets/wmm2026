import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/database';
import { sendConfirmationEmail, emailService } from '@/lib/emailService';

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

    // In development mode, user is auto-confirmed
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return NextResponse.json({
        message: 'User created successfully. You can now sign in.',
        userId: user.id,
        autoConfirmed: true
      });
    }

    // In production, always require email verification
    const token = user.confirmationToken!;
    const confirmationLink = `${process.env.NEXTAUTH_URL}/auth/confirm?token=${token}`;
    
    // Check email service status
    const emailStatus = emailService.getStatus();
    
    if (!emailService.isConfigured()) {
      return NextResponse.json({
        error: 'Email service is not configured. Please contact the administrator.',
        emailStatus
      }, { status: 500 });
    }
    
    const emailSent = await sendConfirmationEmail(email, name, confirmationLink, token);

    if (!emailSent) {
      return NextResponse.json({
        error: 'Failed to send confirmation email. Please try again or contact support.',
        emailStatus
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'User created successfully. Please check your email to confirm your account.',
      userId: user.id,
      emailStatus
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
