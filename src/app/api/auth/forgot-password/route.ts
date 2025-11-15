import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken, getUserByEmail } from '@/lib/secureDatabase';
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

    // In development mode, return the token directly so user can reset immediately
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return NextResponse.json({
        message: 'Password reset token generated',
        resetToken,
        isDevelopment: true,
      });
    }

    // In production, send reset email
    // Determine base URL based on environment
    // For preview deployments, use the Host header to get the branch URL
    // For production, use NEXTAUTH_URL
    // For development, use localhost
    const vercelEnv = process.env.VERCEL_ENV;
    let baseUrl: string;
    
    if (vercelEnv === 'production') {
      // Production: Use NEXTAUTH_URL which should be the production domain
      baseUrl = process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
    } else if (vercelEnv === 'preview') {
      // Preview: Use Host header to get the branch URL (stable across deployments)
      // This ensures emails use the branch URL, not the deployment-specific URL
      const host = request.headers.get('host');
      if (host) {
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        baseUrl = `${protocol}://${host}`;
      } else {
        // Fallback to VERCEL_URL if Host header not available
        baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : process.env.NEXTAUTH_URL || 'http://localhost:3000';
      }
    } else {
      // Development: Use localhost or NEXTAUTH_URL
      baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    }
    
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
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
