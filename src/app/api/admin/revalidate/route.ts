import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { invalidateSiteConfigModuleCache } from '@/config/site';
import { clearStandingsCache } from '@/lib/standingsData';

type RevalidatePathKey = '/' | '/info' | '/hall-of-fame' | '/standings';

const ALLOWED_PATHS: RevalidatePathKey[] = ['/', '/info', '/hall-of-fame', '/standings'];

const PATH_LABELS: Record<RevalidatePathKey, string> = {
  '/': 'Home Page',
  '/info': 'Info Page',
  '/hall-of-fame': 'Hall of Fame',
  '/standings': 'Standings (daily sheet + live pages)',
};

/**
 * POST /api/admin/revalidate — on-demand cache bust for static pages and related data.
 *
 * Body (path mode):
 * `{ "path": "/" | "/info" | "/hall-of-fame" | "/standings" }`
 *
 * Body (site config only):
 * `{ "action": "flush-site-config" }` — invalidates Next `site-config` tag + `config/site` module cache
 * (does not rebuild a specific page). See docs/CACHING_AND_REVALIDATION.md for CDN limits on `/api/site-config`.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body?.action === 'flush-site-config') {
      revalidateTag('site-config');
      invalidateSiteConfigModuleCache();
      return NextResponse.json({
        success: true,
        message:
          'Site config server caches cleared. Client `/api/site-config` may still be edge-cached up to ~5 minutes unless using ?fresh=true.',
        revalidatedAt: new Date().toISOString(),
      });
    }

    const path = body?.path as string | undefined;
    if (!path || !ALLOWED_PATHS.includes(path as RevalidatePathKey)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid path. Allowed: ${ALLOWED_PATHS.join(', ')} or action "flush-site-config"`,
        },
        { status: 400 }
      );
    }

    const typedPath = path as RevalidatePathKey;

    revalidateTag('site-config');
    invalidateSiteConfigModuleCache();

    if (typedPath === '/') {
      revalidateTag('announcements');
    }

    if (typedPath === '/standings') {
      clearStandingsCache();
      revalidatePath('/standings/live');
    }

    revalidatePath(typedPath);

    return NextResponse.json({
      success: true,
      message: `${PATH_LABELS[typedPath]} — caches invalidated and page revalidation triggered`,
      path: typedPath,
      revalidatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error revalidating path:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revalidate path' },
      { status: 500 }
    );
  }
}
