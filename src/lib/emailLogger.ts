/**
 * Email logging utility for tracking email events
 * Logs Account Creation, Password Reset, Bracket Submit, and Bracket Email events
 */

import { sql } from './databaseAdapter';
import { getCurrentEnvironment } from './databaseConfig';
import crypto from 'crypto';

export type EmailEventType = 'Account Creation' | 'Password Reset' | 'Bracket Submit' | 'Bracket Email';

export interface EmailLogEntry {
  eventType: EmailEventType;
  destinationEmail: string;
  attachmentExpected: boolean;
  attachmentSuccess: boolean | null; // null if no attachment expected, true/false if expected
  emailSuccess: boolean;
  timestamp?: Date;
}

/**
 * Log an email event to the database
 * This is fire-and-forget - errors in logging won't break the application
 */
export async function logEmailEvent(entry: EmailLogEntry): Promise<void> {
  try {
    const environment = getCurrentEnvironment();
    const id = crypto.randomUUID();
    const timestamp = entry.timestamp || new Date();
    
    await sql`
      INSERT INTO email_logs (
        id, environment, timestamp, event_type, destination_email,
        attachment_expected, attachment_success, email_success
      ) VALUES (
        ${id},
        ${environment},
        ${timestamp},
        ${entry.eventType},
        ${entry.destinationEmail},
        ${entry.attachmentExpected},
        ${entry.attachmentSuccess},
        ${entry.emailSuccess}
      )
    `;
  } catch (error) {
    // Don't throw - email logging should never break the app
    // Only log to console as fallback
    console.error('[Email Logger] Failed to log email event to database:', error);
    if (error instanceof Error) {
      console.error('[Email Logger] Error details:', error.message);
    }
  }
}

