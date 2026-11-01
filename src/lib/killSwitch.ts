/**
 * Application Master Lock — reads published homepage Key Data.
 * Missing CMS throws — no silent unlocked fallback.
 */

import { getPublishedVintageContent } from '@/lib/vintage/store';
import { SiteConfigError } from '@/lib/siteConfig';
/**
 * Resolve Application Master Lock from published homepage Key Data.
 *
 * Vocabulary:
 * - `enabled: true` → **Unlocked** — no impact on mutations
 * - `enabled: false` → **Locked** — block create/edit/submit/delete
 */
export async function getKillSwitchState(): Promise<{
  enabled: boolean;
  message: string;
}> {
  let home;
  try {
    home = await getPublishedVintageContent();
  } catch (error) {
    throw new SiteConfigError(
      `Cannot resolve Application Master Lock: homepage CMS unavailable (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  return {
    enabled: Boolean(home.keyData.masterLockUnlocked),
    message: home.keyData.masterLockMessage?.trim() ?? '',
  };
}

/**
 * Application Master Lock with explicit naming. `message` may be blank (CMS
 * field empty) — callers must gate on `unlocked`, never on message truthiness.
 */
export async function getMasterLockState(): Promise<{
  unlocked: boolean;
  message: string;
}> {
  const state = await getKillSwitchState();
  return { unlocked: state.enabled, message: state.message };
}
