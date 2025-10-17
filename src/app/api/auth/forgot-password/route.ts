import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken, getUserByEmail } from '@/lib/database';
import { sendPasswordResetEmail } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        message: 'If an account with that email exists, we\'ve sent a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = await createPasswordResetToken(email);

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Failed to create reset token' },
        { status: 500 }
      );
    }

    // Send reset email
    // Use Vercel's dynamic URL or fallback to NEXTAUTH_URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
    // Our email templating builds the link from the provided code, so pass the token as the code
    const emailSent = await sendPasswordResetEmail(email, user.name, resetLink, resetToken);

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send reset email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'If an account with that email exists, we\'ve sent a password reset link.',
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
