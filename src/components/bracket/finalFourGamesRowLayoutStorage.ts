import { BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM } from '@/lib/bracketStepNavMetrics';

/**
 * Shipped Final Four games-row height (no localStorage). Tuning: change {@link DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT}
 * or {@link BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM}.
 */
export type FinalFourGamesRowLayoutState = {
  /** Added to {@link BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM}; total min height is floored to {@link FINAL_FOUR_GAMES_ROW_MIN_TOTAL_REM}. */
  adjustRem: number;
};

/** Final Four games row never shorter than this total (rem). */
export const FINAL_FOUR_GAMES_ROW_MIN_TOTAL_REM = 6;

export const FINAL_FOUR_GAMES_ROW_ADJUST_MIN = -40;
export const FINAL_FOUR_GAMES_ROW_ADJUST_MAX = 32;

/**
 * Shipped offset (rem). Previously came from legacy `wmmBracketEditorCardHeight.finalFourGamesRowAdjustRem` (-6).
 */
export const DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT: FinalFourGamesRowLayoutState = {
  adjustRem: -6,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampAdjust(adjustRem: number): number {
  return clamp(adjustRem, FINAL_FOUR_GAMES_ROW_ADJUST_MIN, FINAL_FOUR_GAMES_ROW_ADJUST_MAX);
}

/** Total min-height (rem) for the Final Four games row. */
export function getFinalFourGamesRowMinHeightRem(adjustRem: number): number {
  return Math.max(
    FINAL_FOUR_GAMES_ROW_MIN_TOTAL_REM,
    BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM + clampAdjust(adjustRem),
  );
}

/** Resolved shipped min height for the games row (rem). */
export const FINAL_FOUR_GAMES_ROW_SHIPPED_MIN_HEIGHT_REM = getFinalFourGamesRowMinHeightRem(
  DEFAULT_FINAL_FOUR_GAMES_ROW_LAYOUT.adjustRem,
);
