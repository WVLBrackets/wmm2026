import { NextResponse } from 'next/server';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';

/**
 * API route to get site configuration
 * This allows client-side components to fetch config without calling unstable_cache directly
 */
export async function GET(request: Request) {
  try {
    const config = await getSiteConfigFromGoogleSheets();
    
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Failed to load site configuration' },
        { status: 500 }
      );
    }
    
    // Debug: Check for happy_path_email_test
    const url = new URL(request.url);
    if (url.searchParams.get('debug') === 'true') {
      return NextResponse.json({ 
        success: true, 
        data: config,
        debug: {
          hasHappyPathEmailTest: !!config.happy_path_email_test,
          happyPathEmailTestValue: config.happy_path_email_test,
          allKeys: Object.keys(config).filter(k => k.toLowerCase().includes('happy') || k.toLowerCase().includes('test'))
        }
      });
    }
    
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching site config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load site configuration' },
      { status: 500 }
    );
  }
}

