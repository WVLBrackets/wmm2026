/**
 * Cross-instance throttle for admin error emails.
 * One row per (environment, key); a send is allowed when the row is older than the window.
 */

import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';

/**
 * Atomically claim the right to send a notification for `key`.
 * Returns `true` when this caller should send (no send within `windowSeconds`).
 * Throws when the table is unavailable so callers can fall back.
 *
 * @param key - Dedup key (e.g. `SiteConfigError:cms:published`)
 * @param windowSeconds - Minimum seconds between sends for this key
 */
export async function claimAdminNotificationSlot(
  key: string,
  windowSeconds: number,
): Promise<boolean> {
  const environment = getCurrentEnvironment();
  const result = await sql`
    INSERT INTO admin_notifications (environment, notify_key, last_sent_at)
    VALUES (${environment}, ${key.slice(0, 255)}, NOW())
    ON CONFLICT (environment, notify_key) DO UPDATE
      SET last_sent_at = NOW()
      WHERE admin_notifications.last_sent_at < NOW() - make_interval(secs => ${windowSeconds})
    RETURNING notify_key
  `;
  return result.rows.length > 0;
}
