/**
 * CSRF (Cross-Site Request Forgery) protection utility
 * 
 * SECURITY: Prevents attackers from tricking authenticated users into
 * making unwanted requests to the application.
 * 
 * Implementation uses the Double Submit Cookie pattern:
 * 1. Server generates a random token
 * 2. Token is stored in a cookie AND must be sent in request header
 * 3. Attacker can't read the cookie value due to same-origin policy
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// CSRF token cookie name
export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

// Token expiry time (24 hours)
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Secret for HMAC signing (use NEXTAUTH_SECRET as base)
function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // In development/testing, use a fallback (not secure for production)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return 'dev-csrf-secret-not-for-production';
    }
    throw new Error('NEXTAUTH_SECRET is required for CSRF protection');
  }
  return secret;
}

/**
 * Generate a new CSRF token
 * Format: timestamp.randomBytes.signature
 */
export function generateCSRFToken(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(16).toString('hex');
  const data = `${timestamp}.${randomPart}`;
  
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('hex')
    .substring(0, 16); // Truncate for shorter token
  
  return `${data}.${signature}`;
}

/**
 * Verify a CSRF token
 * @param token - The token to verify
 * @returns true if valid and not expired
 */
export function verifyCSRFToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  const [timestamp, randomPart, signature] = parts;
  
  // Verify signature
  const data = `${timestamp}.${randomPart}`;
  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('hex')
    .substring(0, 16);
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let isValid = true;
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== expectedSignature[i]) {
      isValid = false;
    }
  }
  
  if (!isValid) {
    return false;
  }
  
  // Check expiry
  const tokenTime = parseInt(timestamp, 36);
  if (isNaN(tokenTime) || Date.now() - tokenTime > TOKEN_EXPIRY_MS) {
    return false;
  }
  
  return true;
}

/**
 * Get or create CSRF token from cookies
 * For use in Server Components
 */
export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (existingToken && verifyCSRFToken(existingToken)) {
    return existingToken;
  }
  
  // Generate new token (will be set by middleware or API route)
  return generateCSRFToken();
}

/**
 * Set CSRF token cookie on response
 */
export function setCSRFCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by client JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_EXPIRY_MS / 1000,
  });
}

/**
 * Validate CSRF token from request
 * Checks both cookie and header match
 * @param request - The incoming request
 * @returns Object with valid status and error message
 */
export function validateCSRFToken(request: NextRequest): { valid: boolean; error?: string } {
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  
  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  
  // Both must be present
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF cookie' };
  }
  
  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF header' };
  }
  
  // Tokens must match (double submit validation)
  if (cookieToken !== headerToken) {
    return { valid: false, error: 'CSRF token mismatch' };
  }
  
  // Token must be valid (signature and expiry)
  if (!verifyCSRFToken(cookieToken)) {
    return { valid: false, error: 'Invalid or expired CSRF token' };
  }
  
  return { valid: true };
}

/**
 * CSRF protection middleware for API routes
 * Returns null if valid, or an error Response if invalid
 * 
 * @param request - The incoming request
 * @param options - Configuration options
 */
export function csrfProtection(
  request: NextRequest,
  options: {
    // Skip CSRF check for these conditions
    skipIfNoSession?: boolean;
    // Custom error handler
    onError?: (error: string) => Response;
  } = {}
): Response | null {
  const method = request.method.toUpperCase();
  
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }
  
  // Validate CSRF token
  const result = validateCSRFToken(request);
  
  if (!result.valid) {
    if (options.onError) {
      return options.onError(result.error || 'CSRF validation failed');
    }
    
    return new Response(
      JSON.stringify({
        error: 'CSRF validation failed',
        message: result.error,
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  return null;
}

/**
 * List of paths that should be exempt from CSRF protection
 * These are typically:
 * - Authentication endpoints (use rate limiting instead)
 * - Webhook endpoints (use signature verification instead)
 * - Public API endpoints
 */
export const CSRF_EXEMPT_PATHS = [
  '/api/auth/', // NextAuth handles its own CSRF
  '/api/email/inbound', // Webhook with signature verification
  '/api/log/', // Logging endpoints (low risk)
  '/api/site-config', // Public read-only
  '/api/team-data', // Public read-only
];

/**
 * Check if a path is exempt from CSRF protection
 */
export function isCSRFExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some(exempt => pathname.startsWith(exempt));
}
