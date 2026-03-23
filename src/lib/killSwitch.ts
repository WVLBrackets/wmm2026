import { getMasterKillSwitchEnabled } from '@/lib/repositories/featureFlagRepository';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

const DEFAULT_KILL_MESSAGE =
  FALLBACK_CONFIG.killSwitchOn || 'Bracket actions are temporarily disabled by the administrator.';

/** Short TTL so a burst of API calls while the switch is OFF does not each hit Google Sheets. */
const DISABLED_MESSAGE_CACHE_TTL_MS = 45_000;

let disabledMessageCache: { message: string; expiresAt: number } | null = null;

/**
 * Load the admin-configured kill-switch message from Google Sheets (only needed when the switch is OFF).
 * Results are cached briefly to avoid repeated slow fetches across concurrent requests.
 */
async function getKillSwitchMessageFromConfig(): Promise<string> {
  const now = Date.now();
  if (disabledMessageCache && disabledMessageCache.expiresAt > now) {
    return disabledMessageCache.message;
  }
  const config = await getSiteConfigFromGoogleSheetsFresh().catch(() => null);
  const message = config?.killSwitchOn || DEFAULT_KILL_MESSAGE;
  disabledMessageCache = { message, expiresAt: now + DISABLED_MESSAGE_CACHE_TTL_MS };
  return message;
}

/**
 * Resolve the current kill switch state and user-facing message when disabled.
 *
 * **Performance:** When the master switch is ON (normal operation), this does **not** call Google Sheets.
 * Previously we always fetched fresh Sheets in parallel with the DB check, which added multi-second latency
 * to every bracket Save/Submit and other API calls that only needed to know “allowed or not”.
 */
export async function getKillSwitchState(): Promise<{ enabled: boolean; message: string }> {
  const enabled = await getMasterKillSwitchEnabled();
  if (enabled) {
    return { enabled: true, message: DEFAULT_KILL_MESSAGE };
  }
  return {
    enabled: false,
    message: await getKillSwitchMessageFromConfig(),
  };
}

/**
 * Return a user-facing kill switch message when actions are disabled (null when allowed).
 * Same fast path as {@link getKillSwitchState}: no Sheets fetch when the switch is ON.
 */
export async function getKillSwitchDisabledMessage(): Promise<string | null> {
  const enabled = await getMasterKillSwitchEnabled();
  if (enabled) {
    return null;
  }
  return getKillSwitchMessageFromConfig();
}
