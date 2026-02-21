import { NextResponse } from 'next/server';
import { generateCSRFToken, setCSRFCookie, CSRF_COOKIE_NAME } from '@/lib/csrf';
import { cookies } from 'next/headers';
import { verifyCSRFToken } from '@/lib/csrf';

/**
 * GET /api/csrf-token
 * Returns a CSRF token for use in subsequent requests
 * Also sets the token as a cookie
 */
export async function GET() {
  // Check if there's an existing valid token
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  let token: string;
  if (existingToken && verifyCSRFToken(existingToken)) {
    token = existingToken;
  } else {
    token = generateCSRFToken();
  }
  
  const response = NextResponse.json({
    csrfToken: token,
  });
  
  // Set the cookie
  setCSRFCookie(response, token);
  
  return response;
}
