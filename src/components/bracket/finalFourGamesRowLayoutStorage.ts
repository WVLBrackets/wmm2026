import { BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM } from '@/lib/bracketStepNavMetrics';

/**
 * Persists Final Four games-row height offset (rem). There is no editor UI; values remain from earlier tuning
 * or defaults. To change shipped height for everyone, edit {@link DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT} or the base rem in metrics.
 */
export const FINAL_FOUR_GAMES_ROW_LAYOUT_LS_KEY = 'wmmFinalFourGamesRowLayout';

/** @deprecated Read once to migrate `finalFourGamesRowAdjustRem` into {@link FINAL_FOUR_GAMES_ROW_LAYOUT_LS_KEY}. */
const LEGACY_BRACKET_CARD_HEIGHT_LS_KEY = 'wmmBracketEditorCardHeight';

export type FinalFourGamesRowLayoutState = {
  /** Added to {@link BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM}; total min height is floored to {@link FINAL_FOUR_GAMES_ROW_MIN_TOTAL_REM}. */
  adjustRem: number;
};

/** Final Four games row never shorter than this total (rem). */
export const FINAL_FOUR_GAMES_ROW_MIN_TOTAL_REM = 6;

export const FINAL_FOUR_GAMES_ROW_ADJUST_MIN = -40;
export const FINAL_FOUR_GAMES_ROW_ADJUST_MAX = 32;

export const DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT: FinalFourGamesRowLayoutState = {
  adjustRem: 0,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampAdjust(adjustRem: number): number {
  return clamp(adjustRem, FINAL_FOUR_GAMES_ROW_ADJUST_MIN, FINAL_FOUR_GAMES_ROW_ADJUST_MAX);
}

function migrateLegacyStorage(): Partial<FinalFourGamesRowLayoutState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_BRACKET_CARD_HEIGHT_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { finalFourGamesRowAdjustRem?: number };
    const v = Number(parsed.finalFourGamesRowAdjustRem);
    if (Number.isNaN(v)) return null;
    return { adjustRem: clampAdjust(v) };
  } catch {
    return null;
  }
}

export function loadFinalFourGamesRowLayout(): FinalFourGamesRowLayoutState {
  if (typeof window === 'undefined') return DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT;
  try {
    const raw = localStorage.getItem(FINAL_FOUR_GAMES_ROW_LAYOUT_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FinalFourGamesRowLayoutState>;
      const a = Number(parsed.adjustRem);
      return {
        adjustRem: clampAdjust(Number.isNaN(a) ? DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT.adjustRem : a),
      };
    }
    const legacy = migrateLegacyStorage();
    if (legacy?.adjustRem != null) {
      return { adjustRem: clampAdjust(legacy.adjustRem) };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT;
}

export function saveFinalFourGamesRowLayout(state: FinalFourGamesRowLayoutState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      FINAL_FOUR_GAMES_ROW_LAYOUT_LS_KEY,
      JSON.stringify({ adjustRem: clampAdjust(state.adjustRem) }),
    );
  } catch {
    /* ignore */
  }
}

export function clearFinalFourGamesRowLayout(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FINAL_FOUR_GAMES_ROW_LAYOUT_LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Total min-height (rem) for the Final Four games row. */
export function getFinalFourGamesRowMinHeightRem(adjustRem: number): number {
  return Math.max(
    FINAL_FOUR_GAMES_ROW_MIN_TOTAL_REM,
    BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM + clampAdjust(adjustRem),
  );
}
