import { getMasterKillSwitchEnabled } from '@/lib/repositories/featureFlagRepository';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

const DEFAULT_LOCK_MESSAGE =
  FALLBACK_CONFIG.masterLockMessage ||
  'Bracket actions are temporarily locked by the administrator.';

/** Short TTL so a burst of API calls while the lock is Locked does not each hit Google Sheets. */
const DISABLED_MESSAGE_CACHE_TTL_MS = 45_000;

let disabledMessageCache: { message: string; expiresAt: number } | null = null;

/**
 * Load the Application Master Lock message from Google Sheets (only needed when Locked).
 * Results are cached briefly to avoid repeated slow fetches across concurrent requests.
 */
async function getMasterLockMessageFromConfig(): Promise<string> {
  const now = Date.now();
  if (disabledMessageCache && disabledMessageCache.expiresAt > now) {
    return disabledMessageCache.message;
  }
  const config = await getSiteConfigFromGoogleSheetsFresh().catch(() => null);
  const message = config?.masterLockMessage || DEFAULT_LOCK_MESSAGE;
  disabledMessageCache = { message, expiresAt: now + DISABLED_MESSAGE_CACHE_TTL_MS };
  return message;
}

/**
 * Resolve Application Master Lock state and user-facing message when Locked.
 *
 * Vocabulary:
 * - `enabled: true` → **Unlocked** (green) — no impact on mutations
 * - `enabled: false` → **Locked** (red) — block create/edit/submit/delete
 *
 * When Unlocked, this does not call Google Sheets.
 */
export async function getKillSwitchState(): Promise<{ enabled: boolean; message: string }> {
  const enabled = await getMasterKillSwitchEnabled();
  if (enabled) {
    return { enabled: true, message: DEFAULT_LOCK_MESSAGE };
  }
  return {
    enabled: false,
    message: await getMasterLockMessageFromConfig(),
  };
}

/**
 * Return a user-facing master-lock message when Locked (null when Unlocked).
 */
export async function getKillSwitchDisabledMessage(): Promise<string | null> {
  const enabled = await getMasterKillSwitchEnabled();
  if (enabled) {
    return null;
  }
  return getMasterLockMessageFromConfig();
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
