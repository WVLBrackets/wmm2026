import { NextRequest } from 'next/server';

/**
 * Parse a URL-like value and return normalized host.
 */
function getHostFromUrl(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validate that a request originates from a trusted first-party host.
 * Uses Origin and Referer headers for defense in depth on sensitive routes.
 */
export function validateTrustedOrigin(request: NextRequest): { valid: boolean; error?: string } {
  const allowedHosts = new Set<string>();
  allowedHosts.add(request.nextUrl.host.toLowerCase());

  const nextAuthHost = process.env.NEXTAUTH_URL ? getHostFromUrl(process.env.NEXTAUTH_URL) : null;
  if (nextAuthHost) {
    allowedHosts.add(nextAuthHost);
  }

  const vercelHost = process.env.VERCEL_URL?.toLowerCase();
  if (vercelHost) {
    allowedHosts.add(vercelHost);
  }

  const extraAllowed = process.env.ALLOWED_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean) || [];
  for (const value of extraAllowed) {
    const host = getHostFromUrl(value);
    if (host) {
      allowedHosts.add(host);
    }
  }

  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  if (!originHeader && !refererHeader) {
    return { valid: false, error: 'Missing Origin/Referer headers' };
  }

  if (originHeader) {
    const originHost = getHostFromUrl(originHeader);
    if (!originHost || !allowedHosts.has(originHost)) {
      return { valid: false, error: 'Untrusted Origin header' };
    }
  }

  if (refererHeader) {
    const refererHost = getHostFromUrl(refererHeader);
    if (!refererHost || !allowedHosts.has(refererHost)) {
      return { valid: false, error: 'Untrusted Referer header' };
    }
  }

  return { valid: true };
}
