import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';

/**
 * POST /api/admin/revalidate - Trigger on-demand revalidation for static pages
 * 
 * This allows admins to manually rebuild cached pages after updating content
 * in Google Sheets or other data sources.
 * 
 * Supported paths:
 * - / (Home page - announcements)
 * - /info (Tournament info)
 * - /hall-of-fame (Hall of Fame)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { path } = body;

    // Validate the path
    const allowedPaths = ['/', '/info', '/hall-of-fame'];
    if (!path || !allowedPaths.includes(path)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid path. Allowed paths: ${allowedPaths.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Trigger revalidation
    revalidatePath(path);

    // Map path to friendly name
    const pathNames: Record<string, string> = {
      '/': 'Home Page',
      '/info': 'Info Page',
      '/hall-of-fame': 'Hall of Fame'
    };

    return NextResponse.json({
      success: true,
      message: `${pathNames[path]} has been rebuilt`,
      path,
      revalidatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error revalidating path:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revalidate path' },
      { status: 500 }
    );
  }
}

