/**
 * Rate limiting utility for API endpoints
 * Uses in-memory storage with automatic cleanup
 * 
 * SECURITY: Prevents brute force attacks, credential stuffing, and DoS
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// In-memory store for rate limit tracking
// Key format: `${identifier}:${endpoint}`
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (run every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Auto-cleanup expired entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Predefined rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits to prevent brute force
  AUTH_LOGIN: { windowMs: 15 * 60 * 1000, maxRequests: 5 },      // 5 attempts per 15 min
  AUTH_REGISTER: { windowMs: 60 * 60 * 1000, maxRequests: 3 },   // 3 registrations per hour
  AUTH_FORGOT_PASSWORD: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 reset requests per hour
  AUTH_RESET_PASSWORD: { windowMs: 15 * 60 * 1000, maxRequests: 5 },  // 5 reset attempts per 15 min
  AUTH_CONFIRM: { windowMs: 15 * 60 * 1000, maxRequests: 10 },   // 10 confirmation attempts per 15 min
  
  // General API endpoints - more lenient
  API_GENERAL: { windowMs: 60 * 1000, maxRequests: 60 },         // 60 requests per minute
  API_WRITE: { windowMs: 60 * 1000, maxRequests: 30 },           // 30 writes per minute
  
  // Admin endpoints
  ADMIN: { windowMs: 60 * 1000, maxRequests: 100 },              // 100 requests per minute for admins
} as const;

/**
 * Get client identifier from request
 * Uses X-Forwarded-For for proxied requests, falls back to connection info
 * @param request - The incoming request
 * @returns Client identifier string
 */
export function getClientIdentifier(request: Request): string {
  // Try X-Forwarded-For first (for proxied requests like Vercel)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try X-Real-IP
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a hash of user-agent + some headers for basic fingerprinting
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const acceptLanguage = request.headers.get('accept-language') || 'unknown';
  return `anon:${hashString(userAgent + acceptLanguage)}`;
}

/**
 * Simple hash function for fingerprinting
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if a request is rate limited
 * @param identifier - Client identifier (usually IP address)
 * @param endpoint - Endpoint identifier for separate limits
 * @param config - Rate limit configuration
 * @returns Object with limited status and retry information
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetIn: number } {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  // No existing entry or window expired - create new entry
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  // Increment count
  entry.count++;
  
  // Check if over limit
  if (entry.count > config.maxRequests) {
    return {
      limited: true,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }
  
  return {
    limited: false,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Rate limit middleware helper for Next.js API routes
 * @param request - The incoming request
 * @param endpoint - Endpoint identifier
 * @param config - Rate limit configuration
 * @returns null if not limited, or a Response object if limited
 */
export function rateLimitMiddleware(
  request: Request,
  endpoint: string,
  config: RateLimitConfig
): Response | null {
  const identifier = getClientIdentifier(request);
  const result = checkRateLimit(identifier, endpoint, config);
  
  if (result.limited) {
    const retryAfterSeconds = Math.ceil(result.resetIn / 1000);
    
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please try again later.',
        retryAfter: retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfterSeconds.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil((Date.now() + result.resetIn) / 1000).toString(),
        },
      }
    );
  }
  
  return null;
}

/**
 * Add rate limit headers to a response
 * @param response - The response to add headers to
 * @param remaining - Remaining requests in window
 * @param resetIn - Milliseconds until reset
 * @param limit - Maximum requests allowed
 */
export function addRateLimitHeaders(
  headers: Headers,
  remaining: number,
  resetIn: number,
  limit: number
): void {
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', Math.ceil((Date.now() + resetIn) / 1000).toString());
}

/**
 * Reset rate limit for a specific identifier and endpoint
 * Useful for testing or admin overrides
 */
export function resetRateLimit(identifier: string, endpoint: string): void {
  const key = `${identifier}:${endpoint}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): { count: number; remaining: number; resetIn: number } {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    return {
      count: 0,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
    };
  }
  
  return {
    count: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: entry.resetTime - now,
  };
}
