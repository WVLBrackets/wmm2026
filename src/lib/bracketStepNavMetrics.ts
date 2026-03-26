/**
 * Shared sizing for the bracket editor bottom bar: step nav columns and Save/Cancel/Submit.
 */

/** Right-side bar actions — included in width so fixed `ch` fits Submit + icon. */
const BRACKET_BAR_WIDTH_HINTS = ['Save', 'Cancel', 'Close'];

/**
 * Min height for region + Final Four steps so switching pages does not jump vertically.
 * Slightly taller than the shortest step so content can sit comfortably centered.
 */
export const BRACKET_EDITOR_STAGE_MIN_HEIGHT_CLASS = 'min-h-[48rem]';

/**
 * Fixed width of the bordered bracket grid (4 region rounds + spacers + Next + summary columns).
 * 4×w-48 + w-8 + w-6 + w-4 + 2×w-24 = 48rem + 4.5rem + 12rem = 64.5rem
 */
export const BRACKET_EDITOR_BORDERED_CONTENT_WIDTH_CLASS = 'w-[64.5rem] max-w-full shrink-0';

/**
 * Max width for the full region row (letters + bordered bracket) so Final Four can align to the same visual frame.
 */
export const BRACKET_EDITOR_STAGE_OUTER_MAX_WIDTH_CLASS = 'max-w-[71rem]';

/**
 * Final Four games row: reserve vertical space comparable to a full region bracket tree so step 5 does not look “short.”
 * @deprecated Final Four row height is tunable; baseline is {@link BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM}rem.
 */
export const BRACKET_EDITOR_FINAL_GAMES_ROW_MIN_HEIGHT_CLASS = 'min-h-[40rem]';

/**
 * Minimum height (rem) for the Final Four step games row only (five-column layout).
 * Region steps use content height for this row so no empty band appears above the step nav.
 */
export const BRACKET_EDITOR_GAMES_ROW_MIN_HEIGHT_REM = 38;

/**
 * Uniform column width in `ch` for each region / Final Four nav cell (and matching action buttons).
 */
export function computeUniformStepNavWidthCh(stepLabels: string[]): number {
  const merged = [...stepLabels, ...BRACKET_BAR_WIDTH_HINTS];
  const longest = merged.reduce((acc, s) => {
    const t = String(s ?? '').trim();
    return t.length > acc.length ? t : acc;
  }, '');
  const perChar = 0.58;
  const iconAndPaddingCh = 4.25;
  const raw = longest.length * perChar + iconAndPaddingCh;
  const base = Math.max(raw, 8.5);
  /** ~+21% vs raw (~10% then +10%) so long labels (e.g. Final Four with parens + check) stay one line. */
  return Math.round(base * 11 * 11) / 100;
}

/**
 * Typography and height aligned with {@link BracketStepNavBar} step buttons (width set via inline style).
 */
/** Matches {@link BracketStepNavBar} step buttons: font, size, height, padding. Width set via inline `ch`. */
export const BRACKET_EDITOR_BAR_ACTION_CLASSES =
  'inline-flex min-h-[2rem] shrink-0 items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-center text-xs font-semibold leading-tight shadow-sm transition-colors box-border';
