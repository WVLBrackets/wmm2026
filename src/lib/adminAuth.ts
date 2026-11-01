import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { getDevAuthBypassEmailServer, isDevAuthBypassServerEnabled } from './devAuth';
import { isAdminEmail } from './adminEmails';

/**
 * Check if an email address matches the admin email from environment variable
 */
export async function isAdmin(email: string): Promise<boolean> {
  if (isDevAuthBypassServerEnabled() && email.toLowerCase() === getDevAuthBypassEmailServer()) {
    return true;
  }
  return isAdminEmail(email);
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

/**
 * Session admin gate for API routes. Returns `{ email }` or a 403 JSON response.
 */
export async function requireAdminRequest(): Promise<{ email: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !(await isAdmin(email))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }
  return { email };
}

