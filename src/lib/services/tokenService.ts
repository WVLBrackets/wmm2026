/**
 * Token Service
 * 
 * Handles token-based operations for email confirmation and password reset.
 */

import { sql } from '../databaseAdapter';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getCurrentEnvironment } from '../databaseConfig';
import { getUserByEmail } from '../repositories/userRepository';

/**
 * Result of email confirmation
 */
export interface ConfirmEmailResult {
  success: boolean;
  userEmail?: string;
  signInToken?: string;
}

/**
 * Confirm a user's email using their confirmation token
 * 
 * @param token - Confirmation token from email link
 * @returns Result with success status and auto-signin token
 */
export async function confirmUserEmail(token: string): Promise<ConfirmEmailResult> {
  try {
    const environment = getCurrentEnvironment();
    
    // Find valid token
    const tokenResult = await sql`
      SELECT * FROM tokens 
      WHERE token = ${token} AND type = 'confirmation' AND expires > NOW() AND environment = ${environment}
    `;
    
    if (tokenResult.rows.length === 0) {
      return { success: false };
    }
    
    const tokenRow = tokenResult.rows[0];
    
    // Get user email
    const userResult = await sql`
      SELECT email
      FROM users
      WHERE id = ${tokenRow.user_id}
        AND environment = ${environment}
    `;
    
    if (userResult.rows.length === 0) {
      return { success: false };
    }
    
    const userEmail = userResult.rows[0].email;
    
    // Mark user as confirmed
    await sql`
      UPDATE users
      SET email_confirmed = TRUE, confirmation_token = NULL, confirmation_expires = NULL
      WHERE id = ${tokenRow.user_id}
        AND environment = ${environment}
    `;
    
    // Create auto-signin token (5 minute expiry)
    const signInToken = crypto.randomUUID();
    const signInExpires = new Date(Date.now() + 5 * 60 * 1000);
    
    await sql`
      INSERT INTO tokens (token, user_id, expires, type, environment)
      VALUES (${signInToken}, ${tokenRow.user_id}, ${signInExpires}, 'auto_signin', ${environment})
    `;
    
    // Remove used confirmation token
    await sql`
      DELETE FROM tokens
      WHERE token = ${token}
        AND environment = ${environment}
    `;
    
    return { success: true, userEmail, signInToken };
  } catch (error) {
    console.error('Error confirming user email:', error);
    return { success: false };
  }
}

/**
 * Create a password reset token for a user
 * 
 * @param email - User's email address
 * @returns Reset token if user found, null otherwise
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const environment = getCurrentEnvironment();
  const user = await getUserByEmail(email);
  
  if (!user) {
    return null;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Update user with reset token
    await sql`
      UPDATE users
      SET reset_token = ${resetToken}, reset_expires = ${resetExpires.toISOString()}
      WHERE id = ${user.id}
        AND environment = ${environment}
    `;

  // Store token
  await sql`
    INSERT INTO tokens (token, user_id, expires, type, environment)
    VALUES (${resetToken}, ${user.id}, ${resetExpires.toISOString()}, 'reset', ${environment})
  `;

  return resetToken;
}

/**
 * Reset a user's password using a reset token
 * 
 * @param token - Reset token from email link
 * @param newPassword - New plain text password (will be hashed)
 * @returns True if password was reset, false if token invalid/expired
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const environment = getCurrentEnvironment();
    
    // Find valid token
    const tokenResult = await sql`
      SELECT * FROM tokens 
      WHERE token = ${token} AND type = 'reset' AND expires > NOW() AND environment = ${environment}
    `;
    
    if (tokenResult.rows.length === 0) {
      return false;
    }
    
    const tokenRow = tokenResult.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password and clear reset token
    await sql`
      UPDATE users 
      SET password = ${hashedPassword}, reset_token = NULL, reset_expires = NULL
      WHERE id = ${tokenRow.user_id} AND environment = ${environment}
    `;
    
    // Remove used token
    await sql`
      DELETE FROM tokens
      WHERE token = ${token}
        AND environment = ${environment}
    `;
    
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  }
}

/**
 * Clean up expired tokens
 * 
 * Should be called periodically to remove old tokens.
 */
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    await sql`DELETE FROM tokens WHERE expires < NOW()`;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
}
