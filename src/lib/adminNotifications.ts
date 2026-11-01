/**
 * Admin notification utility: emails `ADMIN_EMAIL` about critical errors.
 * Throttled to one email per error key per hour across all instances
 * (`admin_notifications` table), with an in-memory fallback.
 */

import { emailService, escapeHtml } from '@/lib/emailService';
import { getAdminEmails } from '@/lib/adminEmails';
import { claimAdminNotificationSlot } from '@/lib/repositories/adminNotificationRepository';

const RATE_LIMIT_SECONDS = 60 * 60;

const memoryThrottle = new Map<string, number>();

/**
 * In-memory throttle used when the DB throttle is unavailable.
 *
 * @param key - Dedup key
 */
function claimMemorySlot(key: string): boolean {
  const now = Date.now();
  const last = memoryThrottle.get(key);
  if (last && now - last < RATE_LIMIT_SECONDS * 1000) return false;
  memoryThrottle.set(key, now);
  return true;
}

/**
 * True when this instance should send for `key` (DB first, memory fallback).
 *
 * @param key - Dedup key
 */
async function claimSlot(key: string): Promise<boolean> {
  try {
    return await claimAdminNotificationSlot(key, RATE_LIMIT_SECONDS);
  } catch (error) {
    console.warn(
      '[Admin Notifications] DB throttle unavailable, using memory:',
      error instanceof Error ? error.message : error,
    );
    return claimMemorySlot(key);
  }
}

/**
 * Send email notification to admin about a critical error.
 * Never throws — notification failures must not break the request.
 *
 * @param error - Error or message
 * @param location - Where it happened (also part of the dedup key)
 * @param context - Optional identifiers / details
 */
export async function notifyAdminOfError(
  error: Error | string,
  location: string,
  context?: {
    bracketId?: string;
    userId?: string;
    userEmail?: string;
    additionalDetails?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const recipients = getAdminEmails();
    if (recipients.length === 0) {
      console.warn('[Admin Notifications] No ADMIN_EMAIL configured, skipping notification');
      return;
    }

    const errorMessage = error instanceof Error ? error.message : error;
    const errorType = error instanceof Error ? error.name || error.constructor.name : 'Unknown';
    const key = `${errorType}:${location}`;

    if (!(await claimSlot(key))) {
      console.log(`[Admin Notifications] Throttled: ${key} (already notified within the hour)`);
      return;
    }

    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
    const subject = `[WMM ${env}] Critical Error: ${errorType} in ${location}`;
    const e = (v: unknown) => escapeHtml(String(v));

    let body = `<h2>Critical Error Detected</h2>`;
    body += `<p><strong>Environment:</strong> ${e(env)}</p>`;
    body += `<p><strong>Error Type:</strong> ${e(errorType)}</p>`;
    body += `<p><strong>Location:</strong> ${e(location)}</p>`;
    body += `<p><strong>Error Message:</strong> ${e(errorMessage)}</p>`;
    if (error instanceof Error && error.stack) {
      body += `<h3>Stack Trace:</h3>`;
      body += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${e(error.stack)}</pre>`;
    }
    if (context) {
      body += `<h3>Context:</h3><ul>`;
      if (context.bracketId) body += `<li><strong>Bracket ID:</strong> ${e(context.bracketId)}</li>`;
      if (context.userId) body += `<li><strong>User ID:</strong> ${e(context.userId)}</li>`;
      if (context.userEmail) body += `<li><strong>User Email:</strong> ${e(context.userEmail)}</li>`;
      for (const [k, v] of Object.entries(context.additionalDetails ?? {})) {
        body += `<li><strong>${e(k)}:</strong> ${e(v)}</li>`;
      }
      body += `</ul>`;
    }
    body += `<p><em>This is an automated notification. You will not receive another email for this error for at least 1 hour.</em></p>`;

    const text = [
      `Critical Error Detected (${env})`,
      `Error Type: ${errorType}`,
      `Location: ${location}`,
      `Error Message: ${errorMessage}`,
    ].join('\n');

    const sent = await emailService.sendEmail({
      to: recipients.join(','),
      subject,
      html: body,
      text,
    });
    if (!sent) console.error('[Admin Notifications] Failed to send error notification email');
  } catch (err) {
    console.error('[Admin Notifications] Error sending notification:', err);
  }
}
