/**
 * Server-side error logging utility
 * Writes errors directly to the error_logs database table
 * Use this in API routes and server-side code (not client-side)
 */

import { sql } from '@/lib/databaseAdapter';
import { getCurrentEnvironment } from '@/lib/databaseConfig';
import crypto from 'crypto';

export interface ServerErrorLogEntry {
  errorMessage: string;
  errorStack?: string;
  errorType?: string;
  location?: string;
  username?: string | null;
  isLoggedIn?: boolean;
  userAgent?: string;
}

/**
 * Log an error to the database (server-side only)
 * This is fire-and-forget - errors in logging won't break the application
 */
export async function logServerError(entry: ServerErrorLogEntry): Promise<void> {
  try {
    const environment = getCurrentEnvironment();
    const id = crypto.randomUUID();
    
    await sql`
      INSERT INTO error_logs (
        id, environment, timestamp, is_logged_in, username,
        error_message, error_stack, error_type, location, user_agent
      ) VALUES (
        ${id},
        ${environment},
        CURRENT_TIMESTAMP,
        ${entry.isLoggedIn ?? false},
        ${entry.username || null},
        ${entry.errorMessage},
        ${entry.errorStack || null},
        ${entry.errorType || null},
        ${entry.location || null},
        ${entry.userAgent || null}
      )
    `;
  } catch (error) {
    // Don't throw - error logging should never break the app
    // Only log to console as fallback
    console.error('[Server Error Logger] Failed to log error to database:', error);
    if (error instanceof Error) {
      console.error('[Server Error Logger] Error details:', error.message);
    }
  }
}

/**
 * Helper to log an Error object with context
 */
export async function logError(
  error: Error | string,
  location: string,
  context?: {
    username?: string | null;
    isLoggedIn?: boolean;
    userAgent?: string;
    additionalInfo?: Record<string, unknown>;
  }
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
  
  // Add additional context to error message if provided
  let fullErrorMessage = errorMessage;
  if (context?.additionalInfo) {
    const contextStr = Object.entries(context.additionalInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    fullErrorMessage = `${errorMessage} (${contextStr})`;
  }
  
  await logServerError({
    errorMessage: fullErrorMessage,
    errorStack,
    errorType,
    location,
    username: context?.username || null,
    isLoggedIn: context?.isLoggedIn ?? false,
    userAgent: context?.userAgent || null,
  });
}

