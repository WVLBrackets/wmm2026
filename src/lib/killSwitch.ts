import { getMasterKillSwitchEnabled } from '@/lib/repositories/featureFlagRepository';
import { getSiteConfigFromGoogleSheetsFresh } from '@/lib/siteConfig';
import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';

/**
 * Resolve the current kill switch state and message.
 */
export async function getKillSwitchState(): Promise<{ enabled: boolean; message: string }> {
  const [enabled, config] = await Promise.all([
    getMasterKillSwitchEnabled(),
    getSiteConfigFromGoogleSheetsFresh().catch(() => null),
  ]);

  return {
    enabled,
    message: config?.killSwitchOn || FALLBACK_CONFIG.killSwitchOn || 'Bracket actions are temporarily disabled.',
  };
}

/**
 * Return a user-facing kill switch message when actions are disabled.
 */
export async function getKillSwitchDisabledMessage(): Promise<string | null> {
  const state = await getKillSwitchState();
  if (state.enabled) {
    return null;
  }
  return state.message;
}
