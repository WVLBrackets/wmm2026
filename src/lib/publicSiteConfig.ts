/**
 * Public site-config allowlist helpers.
 * `/api/site-config` must never expose env-backed test accounts or secrets.
 */

import type { SiteConfigData } from '@/lib/siteConfig';

/** Keys allowed on the unauthenticated site-config payload. */
export const PUBLIC_SITE_CONFIG_KEYS = [
  'tournamentYear',
  'siteName',
  'siteDescription',
  'standingsYear',
  'entryCost',
  'masterLockMessage',
  'contactEmail',
  'footerText',
  'lastYearWinner',
  'lastYearChampionship',
  'tournamentStartDate',
  'bracketsAvailable',
  'bracketsAvailableDateTime',
  'venmoUser',
  'enablePayCapability',
  'enableVenmo',
  'enableZelle',
  'zelleDisplayName',
  'zelleEmail',
  'zellePhone',
  'zelleQrEnabled',
  'zelleQrImageSrc',
] as const satisfies ReadonlyArray<keyof SiteConfigData>;

const FORBIDDEN_KEY_RE =
  /happy_path|email_test|HAPPY_PATH|CRON_SECRET|NEXTAUTH_SECRET|API_KEY|password|secret/i;

/**
 * True when a key name must never appear on the public site-config DTO.
 *
 * @param key - Object key from a site-config payload
 */
export function isForbiddenPublicSiteConfigKey(key: string): boolean {
  if (FORBIDDEN_KEY_RE.test(key)) return true;
  return !(PUBLIC_SITE_CONFIG_KEYS as readonly string[]).includes(key);
}

/**
 * Strip any non-allowlisted keys (defense in depth before JSON response).
 *
 * @param config - Site config from CMS loader
 */
export function toPublicSiteConfig(config: SiteConfigData): SiteConfigData {
  return {
    tournamentYear: config.tournamentYear,
    siteName: config.siteName,
    siteDescription: config.siteDescription,
    standingsYear: config.standingsYear,
    entryCost: config.entryCost,
    masterLockMessage: config.masterLockMessage,
    contactEmail: config.contactEmail,
    footerText: config.footerText,
    lastYearWinner: config.lastYearWinner,
    lastYearChampionship: config.lastYearChampionship,
    tournamentStartDate: config.tournamentStartDate,
    bracketsAvailable: config.bracketsAvailable,
    bracketsAvailableDateTime: config.bracketsAvailableDateTime,
    venmoUser: config.venmoUser,
    enablePayCapability: config.enablePayCapability,
    enableVenmo: config.enableVenmo,
    enableZelle: config.enableZelle,
    zelleDisplayName: config.zelleDisplayName,
    zelleEmail: config.zelleEmail,
    zellePhone: config.zellePhone,
    zelleQrEnabled: config.zelleQrEnabled,
    zelleQrImageSrc: config.zelleQrImageSrc,
  };
}
