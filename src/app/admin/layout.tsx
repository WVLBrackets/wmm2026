import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';

/**
 * Server-side layout protection for admin pages
 * This ensures that only authenticated admins can access admin routes
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  
  // Redirect to sign-in if not authenticated
  if (!session?.user?.email) {
    redirect('/auth/signin');
  }
  
  // Check if user is admin
  const userIsAdmin = await isAdmin(session.user.email);
  
  // Redirect to home if not admin
  if (!userIsAdmin) {
    redirect('/');
  }
  
  return <>{children}</>;
}

