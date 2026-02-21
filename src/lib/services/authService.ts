/**
 * Auth Service
 * 
 * Handles authentication-related operations like password verification.
 */

import bcrypt from 'bcryptjs';
import { getUserByEmail, updateLastLogin } from '../repositories/userRepository';
import type { User } from '../types/database';

/**
 * Password verification error types
 */
export type VerifyPasswordError = 'not_confirmed' | 'invalid';

/**
 * Result of password verification
 */
export interface VerifyPasswordResult {
  user: User | null;
  error?: VerifyPasswordError;
}

/**
 * Verify a user's password
 * 
 * Security considerations:
 * - Returns 'invalid' for non-existent users (doesn't reveal if email exists)
 * - Returns 'not_confirmed' only if password is correct but email unconfirmed
 * - Updates last_login timestamp on successful authentication
 * 
 * @param email - User's email address
 * @param password - Plain text password to verify
 * @returns Result with user if successful, error type if not
 */
export async function verifyPassword(
  email: string, 
  password: string
): Promise<VerifyPasswordResult> {
  try {
    const user = await getUserByEmail(email);
    
    if (!user) {
      return { user: null, error: 'invalid' };
    }

    // Always verify password first to avoid timing attacks
    const isValid = await bcrypt.compare(password, user.password);

    if (!user.emailConfirmed) {
      if (isValid) {
        // Password correct but email not confirmed
        return { user: null, error: 'not_confirmed' };
      }
      // Password wrong - return generic error (don't reveal unconfirmed status)
      return { user: null, error: 'invalid' };
    }

    if (!isValid) {
      return { user: null, error: 'invalid' };
    }

    // Update last login timestamp (non-critical)
    try {
      await updateLastLogin(user.id);
    } catch (updateError) {
      console.error('[verifyPassword] Error updating last_login (non-critical):', updateError);
    }

    return { user };
  } catch (error) {
    console.error('Error verifying password:', error);
    return { user: null, error: 'invalid' };
  }
}
