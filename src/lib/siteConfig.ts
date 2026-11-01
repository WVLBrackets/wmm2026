/**
 * Season, identity, and payment settings derived from published vintage CMS
 * (homepage Key Data, Reigning Champ card, footer, Standings year).
 * All display copy lives in the typed CMS sections, not here.
 *
 * Server loader: `@/lib/siteConfigServer`. Clients: `/api/site-config` via `@/config/site`.
 */
export interface SiteConfigData {
  tournamentYear: string;
  siteName: string;
  siteDescription: string;
  standingsYear: string;
  entryCost: number;
  masterLockMessage: string;
  contactEmail: string;
  footerText: string;
  lastYearWinner: string;
  lastYearChampionship: number;
  /** Homepage tipoff ISO. */
  tournamentStartDate: string;
  /** `YES` / `NO` (Key Data brackets published). */
  bracketsAvailable: string;
  /** Homepage Brackets Ready ISO. */
  bracketsAvailableDateTime: string;
  venmoUser: string;
  enablePayCapability: string;
  enableVenmo: string;
  enableZelle: string;
  zelleDisplayName: string;
  zelleEmail: string;
  zellePhone: string;
  zelleQrEnabled: string;
  zelleQrImageSrc: string;
}

/** Thrown when required published CMS season fields are missing or invalid. */
export class SiteConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiteConfigError';
  }
}
