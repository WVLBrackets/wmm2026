import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/secureDatabase';
import { sendConfirmationEmail, emailService } from '@/lib/emailService';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';

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

    // Always require email verification
    const token = user.confirmationToken;
    
    if (!token) {
      console.error('Registration error: No confirmation token generated for user', user.id);
      return NextResponse.json({
        error: 'Failed to generate confirmation token. Please try again.',
      }, { status: 500 });
    }
    
    // Determine base URL based on environment
    // For preview deployments, use the Host header to get the branch URL
    // For production, use NEXTAUTH_URL
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
          : process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
      }
    } else {
      // Fallback to production URL (should not happen in deployed environments)
      baseUrl = process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
    }
    
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
    
    // Fetch site config for email template
    let siteConfig = null;
    try {
      siteConfig = await getSiteConfigFromGoogleSheets();
    } catch (configError) {
      console.error('[Register] Error fetching site config, using fallbacks:', configError);
      // Continue with fallback config
    }
    
    const emailSent = await sendConfirmationEmail(email, name, confirmationLink, token, siteConfig);

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
