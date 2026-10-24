/**
 * Application Master Lock — reads published homepage Key Data.
 * Legacy DB feature-flag kill-switch and My Picks CMS ownership are retired
 * for this gate; homepage Key Data is source of truth.
 */

import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { getPublishedVintageContent } from '@/lib/vintage/store';

const DEFAULT_LOCK_MESSAGE =
  FALLBACK_CONFIG.masterLockMessage ||
  'Bracket actions are temporarily locked by the administrator.';

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
  try {
    const home = await getPublishedVintageContent();
    return {
      enabled: Boolean(home.keyData.masterLockUnlocked),
      message: home.keyData.masterLockMessage?.trim() || DEFAULT_LOCK_MESSAGE,
    };
  } catch (error) {
    console.warn(
      '[killSwitch] Failed to load homepage Key Data lock; treating as unlocked.',
      error instanceof Error ? error.message : error,
    );
    return { enabled: true, message: DEFAULT_LOCK_MESSAGE };
  }
}

/**
 * Return a user-facing master-lock message when Locked (null when Unlocked).
 */
export async function getKillSwitchDisabledMessage(): Promise<string | null> {
  const state = await getKillSwitchState();
  if (state.enabled) return null;
  return state.message;
}

/**
 * Alias with Application Master Lock naming for newer call sites.
 */
export async function getMasterLockState(): Promise<{
  unlocked: boolean;
  message: string;
}> {
  const state = await getKillSwitchState();
  return { unlocked: state.enabled, message: state.message };
}

/**
 * Message when Locked; null when Unlocked.
 */
export async function getMasterLockDisabledMessage(): Promise<string | null> {
  return getKillSwitchDisabledMessage();
}
