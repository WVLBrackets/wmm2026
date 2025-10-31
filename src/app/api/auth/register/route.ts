import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/secureDatabase';
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
    let user;
    try {
      user = await createUser(email, name, password);
      console.log(`[Register] User created successfully: ${user.id} for email: ${email}`);
    } catch (createError) {
      console.error('[Register] Error creating user:', createError);
      
      // Check if user already exists
      if (createError instanceof Error && createError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'User already exists with this email' },
          { status: 409 }
        );
      }
      
      // Re-throw other errors to be caught by outer catch
      throw createError;
    }

    // In development mode, user is auto-confirmed
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Auto-confirm ONLY in development
    if (isDevelopment) {
      return NextResponse.json({
        message: 'User created successfully. You can now sign in.',
        userId: user.id,
        autoConfirmed: true,
        reason: 'development mode'
      });
    }

    // In production, always require email verification
    const token = user.confirmationToken;
    
    if (!token) {
      console.error('Registration error: No confirmation token generated for user', user.id);
      return NextResponse.json({
        error: 'Failed to generate confirmation token. Please try again.',
      }, { status: 500 });
    }
    
    // Use Vercel's dynamic URL or fallback to NEXTAUTH_URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const confirmationLink = `${baseUrl}/auth/confirm?token=${token}`;
    
    // Check email service status
    const emailStatus = emailService.getStatus();
    
    if (!emailService.isConfigured()) {
      console.error('Registration error: Email service not configured');
      return NextResponse.json({
        error: 'Email service is not configured. Please contact the administrator.',
        emailStatus
      }, { status: 500 });
    }
    
    console.log(`[Register] Sending confirmation email to ${email} with token ${token.substring(0, 10)}...`);
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
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
