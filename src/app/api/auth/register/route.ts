/**
 * User Registration API
 * 
 * POST /api/auth/register
 * Creates a new user account and sends confirmation email.
 */

import { NextRequest } from 'next/server';
import { createUser } from '@/lib/repositories/userRepository';
import { sendConfirmationEmail, emailService } from '@/lib/emailService';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rateLimit';
import { successResponse, ApiErrors } from '@/lib/api/responses';
import { validateRegistration } from '@/lib/validation/validators';
import { ErrorCode } from '@/lib/constants';

export async function POST(request: NextRequest) {
  // Rate limiting to prevent registration abuse
  const rateLimitResponse = rateLimitMiddleware(request, 'auth:register', RATE_LIMITS.AUTH_REGISTER);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email, name, password } = body;

    // Validate input using shared validators
    const validation = validateRegistration({ email, name, password });
    if (!validation.valid) {
      return ApiErrors.validationError(validation.error!);
    }

    // Create user (generates confirmation token)
    let user;
    try {
      user = await createUser(email, name, password);
    } catch (createError) {
      console.error('[Register] Error creating user:', createError);
      
      if (createError instanceof Error && createError.message.includes('already exists')) {
        return ApiErrors.conflict('User already exists with this email');
      }
      
      throw createError;
    }

    // Verify confirmation token was generated
    const token = user.confirmationToken;
    if (!token) {
      console.error('[Register] No confirmation token generated for user:', user.id);
      return ApiErrors.internalError('Failed to generate confirmation token. Please try again.');
    }
    
    // Build confirmation URL based on environment
    const baseUrl = getBaseUrl(request);
    const confirmationLink = `${baseUrl}/auth/confirm?token=${token}`;
    
    // Check email service configuration
    const emailStatus = emailService.getStatus();
    if (!emailService.isConfigured()) {
      console.error('[Register] Email service not configured');
      return ApiErrors.internalError('Email service is not configured. Please contact the administrator.');
    }
    
    // Get site config for email template
    let siteConfig = null;
    try {
      siteConfig = await getSiteConfigFromGoogleSheets();
    } catch (configError) {
      console.error('[Register] Error fetching site config, using fallbacks:', configError);
    }
    
    // Handle test email suppression (non-production only)
    handleTestEmailSuppression(request);
    
    // Send confirmation email
    const emailSent = await sendConfirmationEmail(email, user.name, confirmationLink, token, siteConfig);
    if (!emailSent) {
      return ApiErrors.internalError('Failed to send confirmation email. Please try again or contact support.');
    }

    // Success response
    return successResponse(
      { userId: user.id, emailStatus },
      'User created successfully. Please check your email to confirm your account.'
    );

  } catch (error) {
    console.error('[Register] Unexpected error:', error);
    return ApiErrors.internalError('Registration failed. Please try again later.');
  }
}

/**
 * Determine base URL for confirmation link based on environment
 */
function getBaseUrl(request: NextRequest): string {
  const vercelEnv = process.env.VERCEL_ENV;
  
  if (vercelEnv === 'production') {
    return process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
  }
  
  if (vercelEnv === 'preview') {
    const host = request.headers.get('host');
    if (host) {
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      return `${protocol}://${host}`;
    }
    return process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
  }
  
  return process.env.NEXTAUTH_URL || 'https://wmm2026.vercel.app';
}

/**
 * Handle test email suppression headers (non-production only)
 */
function handleTestEmailSuppression(request: NextRequest): void {
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const suppressTestEmails = !isProduction && request.headers.get('X-Suppress-Test-Emails') === 'true';
  
  if (suppressTestEmails) {
    process.env.SUPPRESS_TEST_EMAILS = 'true';
  }
}
