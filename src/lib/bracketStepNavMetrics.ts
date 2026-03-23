/**
 * Shared sizing for the bracket editor bottom bar: step nav columns and Save/Cancel/Submit.
 */

/** Right-side bar actions — included in width so fixed `ch` fits Submit + icon. */
const BRACKET_BAR_WIDTH_HINTS = ['Submit', 'Save', 'Cancel', 'Close'];

/** Tailwind min-height class so Final Four stage matches region view; keeps bottom bar aligned when switching steps. */
export const BRACKET_EDITOR_STAGE_MIN_HEIGHT_CLASS = 'min-h-[44rem]';

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
  return Math.max(raw, 8.5);
}

/**
 * Typography and height aligned with {@link BracketStepNavBar} step buttons (width set via inline style).
 */
/** Matches {@link BracketStepNavBar} step buttons: font, size, height, padding. Width set via inline `ch`. */
export const BRACKET_EDITOR_BAR_ACTION_CLASSES =
  'inline-flex min-h-[2rem] shrink-0 items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-center text-xs font-semibold leading-tight shadow-sm transition-colors box-border';
