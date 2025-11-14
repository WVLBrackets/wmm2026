/**
 * Admin notification utility
 * Sends email notifications to admins for critical errors
 * Includes rate limiting to prevent spam
 */

import { emailService } from '@/lib/emailService';

// In-memory rate limiting: track last notification time per error type
// In production, consider using Redis or a database for distributed rate limiting
const notificationCache = new Map<string, number>();

// Rate limit: max 1 email per error type per hour
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get admin email from environment variable
 */
function getAdminEmail(): string | null {
  return process.env.ADMIN_EMAIL || null;
}

/**
 * Check if we should send a notification (rate limiting)
 */
function shouldSendNotification(errorType: string): boolean {
  const now = Date.now();
  const lastSent = notificationCache.get(errorType);
  
  if (!lastSent) {
    return true;
  }
  
  const timeSinceLastSent = now - lastSent;
  return timeSinceLastSent >= RATE_LIMIT_MS;
}

/**
 * Mark that a notification was sent
 */
function markNotificationSent(errorType: string): void {
  notificationCache.set(errorType, Date.now());
  
  // Clean up old entries (older than 24 hours) to prevent memory leak
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  for (const [key, timestamp] of notificationCache.entries()) {
    if (timestamp < oneDayAgo) {
      notificationCache.delete(key);
    }
  }
}

/**
 * Send email notification to admin about a critical error
 * Automatically rate-limited to prevent spam
 */
export async function notifyAdminOfError(
  error: Error | string,
  location: string,
  context?: {
    bracketId?: string;
    userId?: string;
    userEmail?: string;
    additionalDetails?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      console.warn('[Admin Notifications] No ADMIN_EMAIL configured, skipping notification');
      return;
    }
    
    const errorMessage = error instanceof Error ? error.message : error;
    const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
    
    // Create a unique key for rate limiting based on error type and location
    const rateLimitKey = `${errorType}:${location}`;
    
    // Check rate limit
    if (!shouldSendNotification(rateLimitKey)) {
      console.log(`[Admin Notifications] Rate limited: ${rateLimitKey} (already notified within last hour)`);
      return;
    }
    
    // Build email subject
    const subject = `[WMM2026] Critical Error: ${errorType} in ${location}`;
    
    // Build email body
    let body = `<h2>Critical Error Detected</h2>`;
    body += `<p><strong>Error Type:</strong> ${errorType}</p>`;
    body += `<p><strong>Location:</strong> ${location}</p>`;
    body += `<p><strong>Error Message:</strong> ${errorMessage}</p>`;
    
    if (error instanceof Error && error.stack) {
      body += `<h3>Stack Trace:</h3>`;
      body += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${error.stack}</pre>`;
    }
    
    if (context) {
      body += `<h3>Context:</h3>`;
      body += `<ul>`;
      if (context.bracketId) {
        body += `<li><strong>Bracket ID:</strong> ${context.bracketId}</li>`;
      }
      if (context.userId) {
        body += `<li><strong>User ID:</strong> ${context.userId}</li>`;
      }
      if (context.userEmail) {
        body += `<li><strong>User Email:</strong> ${context.userEmail}</li>`;
      }
      if (context.additionalDetails) {
        for (const [key, value] of Object.entries(context.additionalDetails)) {
          body += `<li><strong>${key}:</strong> ${String(value)}</li>`;
        }
      }
      body += `</ul>`;
    }
    
    body += `<p><em>This is an automated notification. You will not receive another email for this error type for at least 1 hour.</em></p>`;
    
    // Send email
    const emailSent = await emailService.sendEmail({
      to: adminEmail,
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });
    
    if (emailSent) {
      markNotificationSent(rateLimitKey);
      console.log(`[Admin Notifications] Error notification sent to ${adminEmail} for ${rateLimitKey}`);
    } else {
      console.error('[Admin Notifications] Failed to send error notification email');
    }
  } catch (error) {
    // Don't throw - notification failures shouldn't break the app
    console.error('[Admin Notifications] Error sending notification:', error);
  }
}

