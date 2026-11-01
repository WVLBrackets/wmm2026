import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import OpsAdminChrome from '@/components/OpsAdminChrome';
import {
  DEFAULT_VINTAGE_CONTENT,
  defaultToolbar,
} from '@/lib/vintage/content';
import { getPublishedVintageContent } from '@/lib/vintage/store';

/**
 * Server-side layout protection for admin pages.
 * Ops screens keep their existing body UI but use the vintage public header.
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

  let toolbar = defaultToolbar();
  let mastheadFirst = DEFAULT_VINTAGE_CONTENT.masthead.first;
  let mastheadSecond = DEFAULT_VINTAGE_CONTENT.masthead.second;
  try {
    const home = await getPublishedVintageContent();
    toolbar = home.toolbar;
    mastheadFirst = home.masthead.first;
    mastheadSecond = home.masthead.second;
  } catch {
    // Fall back to defaults if vintage CMS is unavailable
  }

  return (
    <OpsAdminChrome
      toolbar={toolbar}
      mastheadFirst={mastheadFirst}
      mastheadSecond={mastheadSecond}
    >
      {children}
    </OpsAdminChrome>
  );
}

