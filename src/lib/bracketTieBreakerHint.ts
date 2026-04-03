import { FALLBACK_CONFIG } from '@/lib/fallbackConfig';
import type { SiteConfigData } from '@/lib/siteConfig';

/**
 * Tooltip / `title` text for tie breaker fields: same copy as the Final Four step info panel
 * (`tieBreakerHint` with `||` paragraph breaks → newlines).
 */
export function getTieBreakerHintTooltipText(siteConfig?: SiteConfigData | null): string {
  const source = (siteConfig?.tieBreakerHint?.trim() || FALLBACK_CONFIG.tieBreakerHint || '').trim();
  if (!source) return '';
  return source
    .split(/\|\|/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Allows empty string or digits only (non-negative integers as string). Use for controlled inputs.
 */
export function filterTieBreakerIntegerString(raw: string): string | null {
  if (raw === '') return '';
  return /^\d+$/.test(raw) ? raw : null;
}
