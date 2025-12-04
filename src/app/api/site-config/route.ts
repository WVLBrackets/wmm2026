import { NextResponse } from 'next/server';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';

/**
 * API route to get site configuration
 * This allows client-side components to fetch config without calling unstable_cache directly
 * 
 * CDN Caching: Responses are cached at Vercel's edge for 5 minutes (s-maxage=300)
 * with stale-while-revalidate for 10 minutes (background refresh)
 */
export async function GET(request: Request) {
  try {
    // Check if we should bypass cache (for testing or when fresh data is needed)
    const url = new URL(request.url);
    const bypassCache = url.searchParams.has('_t') || url.searchParams.get('fresh') === 'true';
    
    // Import the fresh function if we need to bypass cache
    const { getSiteConfigFromGoogleSheetsFresh } = await import('@/lib/siteConfig');
    const config = bypassCache 
      ? await getSiteConfigFromGoogleSheetsFresh()
      : await getSiteConfigFromGoogleSheets();
    
    if (!config) {
      // Don't cache error responses
      return NextResponse.json(
        { success: false, error: 'Failed to load site configuration' },
        { status: 500 }
      );
    }
    
    // CDN cache headers: 5 min cache, 10 min stale-while-revalidate
    // Skip caching if bypass was requested
    const cacheHeaders = bypassCache 
      ? { 'Cache-Control': 'no-store' }
      : { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
    
    // Debug mode (if needed in future)
    if (url.searchParams.get('debug') === 'true') {
      return NextResponse.json({ 
        success: true, 
        data: config,
        debug: {
          hasHappyPathEmailTestChrome: !!config.happy_path_email_test_chrome,
          hasHappyPathEmailTestFirefox: !!config.happy_path_email_test_firefox,
          hasHappyPathEmailTestWebkit: !!config.happy_path_email_test_webkit,
          hasHappyPathEmailTestMobileChrome: !!config.happy_path_email_test_mobile_chrome,
          hasHappyPathEmailTestMobileWebkit: !!config.happy_path_email_test_mobile_webkit,
          hasHappyPathEmailTestMobileWebkitPro: !!config.happy_path_email_test_mobile_webkit_pro,
          allKeys: Object.keys(config).filter(k => k.toLowerCase().includes('happy') || k.toLowerCase().includes('test'))
        }
      }, { headers: cacheHeaders });
    }
    
    return NextResponse.json(
      { success: true, data: config },
      { headers: cacheHeaders }
    );
  } catch (error) {
    console.error('Error fetching site config:', error);
    // Don't cache error responses
    return NextResponse.json(
      { success: false, error: 'Failed to load site configuration' },
      { status: 500 }
    );
  }
}

