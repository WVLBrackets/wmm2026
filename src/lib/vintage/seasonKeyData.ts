import type { VintageContent } from '@/lib/vintage/content';
import type { VintagePicksContent } from '@/lib/vintage/picksContent';

/**
 * Overlay homepage Key Data season controls onto My Picks copy.
 * Editorial picks fields stay on the picks sidecar; gates/cost/lock come from Key Data.
 * Venmo / Pay capability are overlaid on `/api/site-config` (not picks copy).
 *
 * @param home - Published (or draft) homepage content
 * @param picks - My Picks CMS copy
 */
export function applyHomepageKeyDataToPicks(
  home: VintageContent,
  picks: VintagePicksContent,
): VintagePicksContent {
  const kd = home.keyData;
  return {
    ...picks,
    bracketsPublished: kd.bracketsPublished,
    entryCost: kd.entryCost,
    masterLockUnlocked: kd.masterLockUnlocked,
    masterLockMessage: kd.masterLockMessage,
  };
}

/**
 * Reigning Champ card fields used for nav “Current Champ” chrome.
 */
export function getReigningChampFromHome(home: VintageContent): {
  name: string;
  year: string;
} {
  const card = home.homeCards.find((c) => c.type === 'reigningChamp');
  return {
    name: card?.champName?.trim() || '',
    year: card?.champYear?.trim() || '',
  };
}

/**
 * True when stored homepage JSON already includes a `keyData` object
 * (vs. normalize filling defaults for a missing block).
 *
 * @param rawHomepage - Homepage fragment before normalize (sidecars stripped)
 */
export function rawHomepageHasKeyData(rawHomepage: unknown): boolean {
  return Boolean(
    rawHomepage &&
      typeof rawHomepage === 'object' &&
      !Array.isArray(rawHomepage) &&
      'keyData' in (rawHomepage as object),
  );
}
