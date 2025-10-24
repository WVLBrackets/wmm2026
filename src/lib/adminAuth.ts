import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * Check if an email address matches the admin email from environment variable
 */
export async function isAdmin(email: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  return email.toLowerCase() === adminEmail.toLowerCase();
}

/**
 * Check if the current session user is an admin
 */
export async function isUserAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return false;
  }
  
  return isAdmin(session.user.email);
}

/**
 * Require admin access, throw error if not admin
 */
export async function requireAdmin() {
  const isAdminUser = await isUserAdmin();
  
  if (!isAdminUser) {
    throw new Error('Unauthorized: Admin access required');
  }
  
  return true;
}

