import { NextResponse } from 'next/server';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';
import { getReigningChampFromHome } from '@/lib/vintage/seasonKeyData';
import { getPublishedVintageContent } from '@/lib/vintage/store';

/**
 * API route to get site configuration
 * This allows client-side components to fetch config without calling unstable_cache directly
 *
 * Homepage Key Data overlays:
 * - tournamentYear, entryCost, siteName, masterLockMessage (always CMS)
 * - venmoUser, enablePayCapability (CMS once Pay fields are set; else sheet)
 * - lastYearWinner / lastYearChampionship from Reigning Champ card
 * - contactMe from footer.contactEmail when set
 *
 * CDN Caching: Responses are cached at Vercel's edge for 5 minutes (s-maxage=300)
 * with stale-while-revalidate for 10 minutes (background refresh)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bypassCache = url.searchParams.has('_t') || url.searchParams.get('fresh') === 'true';

    const { getSiteConfigFromGoogleSheetsFresh } = await import('@/lib/siteConfig');
    const sheetConfig = bypassCache
      ? await getSiteConfigFromGoogleSheetsFresh()
      : await getSiteConfigFromGoogleSheets();

    if (!sheetConfig) {
      return NextResponse.json(
        { success: false, error: 'Failed to load site configuration' },
        { status: 500 }
      );
    }

    const [cmsYear, home] = await Promise.all([
      getActiveTournamentYear(),
      getPublishedVintageContent(),
    ]);
    const champ = getReigningChampFromHome(home);
    const cmsVenmo = home.keyData.venmoUser?.trim() || '';
    /** CMS owns Pay once Venmo is set or the public-Pay toggle is on; else keep sheet. */
    const cmsPayConfigured =
      Boolean(cmsVenmo) || home.keyData.enablePayCapability === true;
    const config = {
      ...sheetConfig,
      tournamentYear: String(cmsYear),
      siteName: home.keyData.siteName || sheetConfig.siteName,
      entryCost: home.keyData.entryCost,
      masterLockMessage: home.keyData.masterLockMessage || sheetConfig.masterLockMessage,
      venmoUser: cmsVenmo || sheetConfig.venmoUser,
      enablePayCapability: cmsPayConfigured
        ? home.keyData.enablePayCapability
          ? 'YES'
          : 'NO'
        : sheetConfig.enablePayCapability,
      lastYearWinner: champ.name || sheetConfig.lastYearWinner,
      lastYearChampionship: champ.year || sheetConfig.lastYearChampionship,
      contactMe: home.footer.contactEmail?.trim() || sheetConfig.contactMe,
    };

    const cacheHeaders = bypassCache
      ? { 'Cache-Control': 'no-store' }
      : { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };

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
    return NextResponse.json(
      { success: false, error: 'Failed to load site configuration' },
      { status: 500 }
    );
  }
}
