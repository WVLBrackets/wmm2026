/**
 * Persists optional geometry overrides for the full bracket canvas (KEY admin "Show Layout Controls").
 * Standings / bracket viewer reads the same storage so previews match what admins tuned on this browser.
 */

import { DEFAULT_FULL_BRACKET_LAYOUT, type LayoutSettings } from '@/lib/fullBracket/fullBracketGeometry';
import { mergeLayoutSettings } from '@/lib/fullBracket/layoutMerge';

/** Current key for KEY modal persistence (writes always use this). */
export const KEY_BRACKET_PREVIEW_LAYOUT_STORAGE_KEY = 'keyBracketPreviewLayoutV2';

/** Original key; still read when V2 is empty so existing tuned browsers keep their layout. */
export const KEY_BRACKET_PREVIEW_LAYOUT_STORAGE_KEY_LEGACY = 'keyBracketPreviewLayout';

export function mergeKeyBracketPreviewLayoutFromStorage(parsed: unknown): LayoutSettings {
  return mergeLayoutSettings(DEFAULT_FULL_BRACKET_LAYOUT, parsed);
}

/**
 * Client-only: returns defaults when `window` is missing or storage is empty/invalid.
 */
export function readKeyBracketPreviewLayoutFromStorage(): LayoutSettings {
  if (typeof window === 'undefined') return DEFAULT_FULL_BRACKET_LAYOUT;
  try {
    const raw =
      window.localStorage.getItem(KEY_BRACKET_PREVIEW_LAYOUT_STORAGE_KEY) ??
      window.localStorage.getItem(KEY_BRACKET_PREVIEW_LAYOUT_STORAGE_KEY_LEGACY);
    if (!raw) return DEFAULT_FULL_BRACKET_LAYOUT;
    return mergeKeyBracketPreviewLayoutFromStorage(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_FULL_BRACKET_LAYOUT;
  }
}
