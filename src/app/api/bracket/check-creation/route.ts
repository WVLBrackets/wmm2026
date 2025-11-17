import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { checkSubmissionAllowed } from '@/lib/bracketSubmissionValidator';

/**
 * GET /api/bracket/check-creation - Check if bracket creation is currently allowed
 * Returns whether bracket creation is allowed based on stop_submit_toggle and stop_submit_date_time
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get fresh site config to check submission rules
    let siteConfig = null;
    try {
      siteConfig = await getSiteConfigFromGoogleSheets();
    } catch {
      // Use fallback config if Google Sheets fails
      const { FALLBACK_CONFIG } = await import('@/lib/fallbackConfig');
      siteConfig = FALLBACK_CONFIG;
    }

    // Check if bracket creation is allowed
    const submissionCheck = checkSubmissionAllowed(siteConfig);
    
    return NextResponse.json({
      success: true,
      allowed: submissionCheck.allowed,
      reason: submissionCheck.reason || undefined
    });
  } catch (error) {
    console.error('Error checking bracket creation status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check bracket creation status',
        allowed: false // Default to not allowed on error
      },
      { status: 500 }
    );
  }
}

