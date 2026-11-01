import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/services/tokenService';
import { getUserByEmail } from '@/lib/repositories/userRepository';
import { sendPasswordResetEmail } from '@/lib/emailService';
import { SiteConfigError } from '@/lib/siteConfig';
import { getAccountEmailContext } from '@/lib/siteConfigServer';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { requireAppOrigin } from '@/lib/env';

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting to prevent email flooding
  const rateLimitResponse = rateLimitMiddleware(request, 'auth:forgot-password', RATE_LIMITS.AUTH_FORGOT_PASSWORD);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

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
    // Determine base URL based on environment
    // For preview deployments, use the Host header to get the branch URL
    // For production, use NEXTAUTH_URL
    const vercelEnv = process.env.VERCEL_ENV;
    let baseUrl: string;
    if (vercelEnv === 'preview') {
      const host = request.headers.get('host');
      if (host) {
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        baseUrl = `${protocol}://${host}`;
      } else if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        baseUrl = requireAppOrigin();
      }
    } else {
      baseUrl = requireAppOrigin();
    }
    
    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
    let emailContext;
    try {
      emailContext = await getAccountEmailContext();
    } catch (error) {
      const message =
        error instanceof SiteConfigError
          ? error.message
          : 'Site configuration is unavailable.';
      return NextResponse.json({ error: message }, { status: 503 });
    }
    
    // Check for email suppression header from test environment
    // SECURITY: Only honor suppression headers in non-production environments
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const suppressTestEmails = !isProduction && request.headers.get('X-Suppress-Test-Emails') === 'true';
    if (suppressTestEmails) {
      process.env.SUPPRESS_TEST_EMAILS = 'true';
    }
    
    // Our email templating builds the link from the provided code, so pass the token as the code
    const emailSent = await sendPasswordResetEmail(email, user.name, resetLink, resetToken, emailContext);

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
