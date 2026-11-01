import { NextResponse } from 'next/server';
import { toPublicSiteConfig } from '@/lib/publicSiteConfig';
import { SiteConfigError } from '@/lib/siteConfig';
import { getSiteConfigCached } from '@/lib/siteConfigServer';

/**
 * Site configuration from the published vintage CMS bundle.
 * Missing required Key Data (Tourney Year, site name) or CMS failure → 503.
 *
 * Returns allowlisted public fields only (no env test emails / secrets).
 * The server bundle is invalidated on CMS publish (`revalidateTag`), so `fresh=true`
 * only skips the CDN layer (`no-store`); it never bypasses the published CMS.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bypassCdn =
      url.searchParams.has('_t') || url.searchParams.get('fresh') === 'true';
    const config = toPublicSiteConfig(await getSiteConfigCached());
    return NextResponse.json(
      { success: true, data: config },
      {
        headers: bypassCdn
          ? { 'Cache-Control': 'no-store' }
          : { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      },
    );
  } catch (error) {
    console.error('Error fetching site config:', error);
    const isConfigError = error instanceof SiteConfigError;
    return NextResponse.json(
      {
        success: false,
        error: isConfigError ? error.message : 'Failed to load site configuration',
      },
      { status: isConfigError ? 503 : 500 },
    );
  }
}
