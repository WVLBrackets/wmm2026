/**
 * Server-only site config loader (published vintage CMS → SiteConfigData).
 * Do not import from Client Components — use `/api/site-config` or `@/config/site`.
 */

import 'server-only';
import type { AccountEmailContext } from '@/lib/emailService';
import { SiteConfigData, SiteConfigError } from '@/lib/siteConfig';
import { getPublishedCmsBundle, type VintageCmsBundle } from '@/lib/vintage/cmsBundle';
import { getReigningChampFromHome } from '@/lib/vintage/seasonKeyData';

const yn = (value: boolean) => (value ? 'YES' : 'NO');

/**
 * Map a published CMS bundle to SiteConfigData.
 *
 * @param bundle - Published CMS bundle
 * @throws SiteConfigError when Tourney Year or site name is missing
 */
export function siteConfigFromBundle(bundle: VintageCmsBundle): SiteConfigData {
  const { home, standings } = bundle;
  const tournamentYear = home.tournament?.year?.trim() ?? '';
  if (!/^\d{4}$/.test(tournamentYear)) {
    throw new SiteConfigError('Published homepage Key Data is missing a valid Tourney Year (YYYY).');
  }
  const kd = home.keyData;
  const siteName = kd.siteName?.trim() ?? '';
  if (!siteName) {
    throw new SiteConfigError('Published homepage Key Data is missing site name.');
  }
  const sy = standings.standingsYear?.trim() ?? '';
  const champ = getReigningChampFromHome(home);
  const champYearNum = parseInt(champ.year, 10);

  return {
    tournamentYear,
    siteName,
    siteDescription: kd.siteDescription?.trim() ?? '',
    standingsYear: /^\d{4}$/.test(sy) ? sy : tournamentYear,
    entryCost: kd.entryCost,
    masterLockMessage: kd.masterLockMessage?.trim() ?? '',
    contactEmail: home.footer.contactEmail?.trim() ?? '',
    footerText: home.footer.text?.trim() ?? '',
    lastYearWinner: champ.name,
    lastYearChampionship: Number.isFinite(champYearNum) ? champYearNum : 0,
    tournamentStartDate: home.tournament.tipoffAt?.trim() ?? '',
    bracketsAvailable: yn(kd.bracketsPublished),
    bracketsAvailableDateTime: home.tournament.bracketsReadyAt?.trim() ?? '',
    venmoUser: kd.venmoUser?.trim() ?? '',
    enablePayCapability: yn(kd.enablePayCapability === true),
    enableVenmo: yn(kd.enableVenmo !== false),
    enableZelle: yn(kd.enableZelle !== false),
    zelleDisplayName: kd.zelleDisplayName?.trim() ?? '',
    zelleEmail: kd.zelleEmail?.trim() ?? '',
    zellePhone: kd.zellePhone?.trim() ?? '',
    zelleQrEnabled: yn(kd.zelleQrEnabled !== false),
    zelleQrImageSrc: kd.zelleQrImageSrc?.trim() ?? '',
  };
}

/**
 * Site config from the cached published CMS bundle (one read per request,
 * 5-minute cache, invalidated on CMS writes).
 *
 * @throws SiteConfigError when CMS is unavailable or required fields are missing
 */
export async function getSiteConfigCached(): Promise<SiteConfigData> {
  let bundle: VintageCmsBundle;
  try {
    bundle = await getPublishedCmsBundle();
  } catch (error) {
    throw new SiteConfigError(
      `Published CMS is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    return siteConfigFromBundle(bundle);
  } catch (error) {
    if (error instanceof SiteConfigError) {
      void import('@/lib/adminNotifications').then(({ notifyAdminOfError }) =>
        notifyAdminOfError(error, 'cms:site-config'),
      );
    }
    throw error;
  }
}

/**
 * Published Emails & Account copy plus season/contact values for account emails.
 *
 * @throws SiteConfigError when CMS is unavailable or required fields are missing
 */
export async function getAccountEmailContext(): Promise<AccountEmailContext> {
  const config = await getSiteConfigCached();
  const bundle = await getPublishedCmsBundle();
  return {
    emails: bundle.emails,
    tournamentYear: config.tournamentYear,
    contactEmail: config.contactEmail,
  };
}