import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  emailConfirmed: boolean;
  confirmationToken?: string;
  confirmationExpires?: Date;
  resetToken?: string;
  resetExpires?: Date;
  createdAt: Date;
}

export interface ConfirmationToken {
  token: string;
  userId: string;
  expires: Date;
  type: 'confirmation' | 'reset';
}

// In-memory database for demo purposes
// In production, this would be a real database like PostgreSQL, MongoDB, etc.
const users: User[] = [];
const tokens: ConfirmationToken[] = [];

export async function createUser(email: string, name: string, password: string): Promise<User> {
  // Check if user already exists
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);
  
  // Generate confirmation token
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const confirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // In development mode or when email service is not configured, auto-confirm emails
  const isDevelopment = process.env.NODE_ENV === 'development';
  const emailNotConfigured = !process.env.EMAIL_USER || !process.env.EMAIL_PASS;
  const shouldAutoConfirm = isDevelopment || emailNotConfigured;
  
  const user: User = {
    id: crypto.randomUUID(),
    email,
    name,
    password: hashedPassword,
    emailConfirmed: shouldAutoConfirm, // Auto-confirm in development or when email not configured
    confirmationToken: shouldAutoConfirm ? undefined : confirmationToken,
    confirmationExpires: shouldAutoConfirm ? undefined : confirmationExpires,
    createdAt: new Date(),
  };

  users.push(user);
  
  // Store confirmation token only if email service is configured and not in development mode
  if (!shouldAutoConfirm) {
    tokens.push({
      token: confirmationToken,
      userId: user.id,
      expires: confirmationExpires,
      type: 'confirmation'
    });
  }

  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return users.find(u => u.email === email) || null;
}

export async function getUserById(id: string): Promise<User | null> {
  return users.find(u => u.id === id) || null;
}

export async function confirmUserEmail(token: string): Promise<boolean> {
  const tokenRecord = tokens.find(t => t.token === token && t.type === 'confirmation');
  
  if (!tokenRecord || tokenRecord.expires < new Date()) {
    return false;
  }

  const user = users.find(u => u.id === tokenRecord.userId);
  if (!user) {
    return false;
  }

  // Mark email as confirmed
  user.emailConfirmed = true;
  user.confirmationToken = undefined;
  user.confirmationExpires = undefined;

  // Remove token
  const tokenIndex = tokens.indexOf(tokenRecord);
  tokens.splice(tokenIndex, 1);

  return true;
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await getUserByEmail(email);
  if (!user) {
    return null;
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Update user with reset token
  user.resetToken = resetToken;
  user.resetExpires = resetExpires;

  // Store reset token
  tokens.push({
    token: resetToken,
    userId: user.id,
    expires: resetExpires,
    type: 'reset'
  });

  return resetToken;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const tokenRecord = tokens.find(t => t.token === token && t.type === 'reset');
  
  if (!tokenRecord || tokenRecord.expires < new Date()) {
    return false;
  }

  const user = users.find(u => u.id === tokenRecord.userId);
  if (!user) {
    return false;
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  user.resetToken = undefined;
  user.resetExpires = undefined;

  // Remove token
  const tokenIndex = tokens.indexOf(tokenRecord);
  tokens.splice(tokenIndex, 1);

  return true;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  try {
    console.log('Database: Looking up user by email:', email);
    const user = await getUserByEmail(email);
    if (!user) {
      console.log('Database: User not found:', email);
      return null;
    }

    if (!user.emailConfirmed) {
      console.log('Database: User email not confirmed:', email);
      return null;
    }

    console.log('Database: Comparing password for user:', email);
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('Database: Password invalid for user:', email);
      return null;
    }

    console.log('Database: Password verified for user:', email);
    return user;
  } catch (error) {
    console.error('Database: Error verifying password:', error);
    return null;
  }
}

// Clean up expired tokens (call this periodically)
export function cleanupExpiredTokens(): void {
  const now = new Date();
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].expires < now) {
      tokens.splice(i, 1);
    }
  }
}
