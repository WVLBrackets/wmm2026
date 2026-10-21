/**
 * Application Master Lock — reads published My Picks CMS.
 * Legacy DB feature-flag kill-switch is retired; CMS is source of truth.
 */

import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import { getPublishedVintagePicksContent } from '@/lib/vintage/picksStore';

const DEFAULT_LOCK_MESSAGE =
  FALLBACK_CONFIG.masterLockMessage ||
  'Bracket actions are temporarily locked by the administrator.';

/**
 * Resolve Application Master Lock from published My Picks CMS.
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
    const picks = await getPublishedVintagePicksContent();
    return {
      enabled: Boolean(picks.masterLockUnlocked),
      message: picks.masterLockMessage?.trim() || DEFAULT_LOCK_MESSAGE,
    };
  } catch (error) {
    console.warn(
      '[killSwitch] Failed to load My Picks CMS lock; treating as unlocked.',
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
