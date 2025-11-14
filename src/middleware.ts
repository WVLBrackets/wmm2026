import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to exclude static assets from authentication
 * This prevents 401 errors on favicon and other static file requests
 * 
 * In Next.js App Router, static files in public/ should be served directly,
 * but sometimes route handlers can intercept them. This middleware ensures
 * static assets bypass any authentication checks.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude static assets - these should never require authentication
  const isStaticAsset = 
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/favicon.ico' ||
    pathname === '/basketball-favicon.png' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/logos/') ||
    pathname.startsWith('/data/') ||
    /\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|css|js|json)$/i.test(pathname);

  if (isStaticAsset) {
    // Allow static assets to pass through without any authentication
    return NextResponse.next();
  }

  // For all other routes, continue normally (they may have their own auth checks)
  return NextResponse.next();
}

// Configure which routes this middleware runs on
// We exclude static files from matching to avoid unnecessary processing
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and other static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|basketball-favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js|json)).*)',
  ],
};

