/**
 * Shared chrome for full-bracket viewports (standings modal, KEY modal, My Picks editor).
 * Single horizontal inset so layout matches and bracket uses maximum width.
 */
export const FULL_BRACKET_VIEWPORT_PADDING_X = 'px-2 sm:px-3';

/** Set `NEXT_PUBLIC_DEBUG_BRACKET_LAYOUT=1` in `.env.local` to draw dashed outlines (staging / layout QA). */
export const FULL_BRACKET_DEBUG_LAYOUT =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_BRACKET_LAYOUT === '1';

export const FULL_BRACKET_DEBUG_OUTLINE_LAYERS = {
  page: 'outline outline-2 -outline-offset-1 outline-dashed outline-red-500',
  shell: 'outline outline-2 -outline-offset-1 outline-dashed outline-orange-500',
  card: 'outline outline-2 -outline-offset-1 outline-dashed outline-blue-500',
  canvasWrap: 'outline outline-2 -outline-offset-1 outline-dashed outline-green-600',
  canvasRoot: 'outline outline-2 -outline-offset-1 outline-dashed outline-purple-500',
  bracketFrame: 'outline outline-2 -outline-offset-1 outline-dashed outline-rose-500',
  grid: 'outline outline-2 -outline-offset-1 outline-dashed outline-fuchsia-500',
  cell: 'outline outline-2 -outline-offset-1 outline-dashed outline-amber-500',
} as const;

export type FullBracketDebugOutlineLayer = keyof typeof FULL_BRACKET_DEBUG_OUTLINE_LAYERS;

/**
 * Dashed outline for layout debugging (no effect unless {@link FULL_BRACKET_DEBUG_LAYOUT}).
 */
export function fullBracketDebugOutline(layer: FullBracketDebugOutlineLayer): string {
  return FULL_BRACKET_DEBUG_LAYOUT ? FULL_BRACKET_DEBUG_OUTLINE_LAYERS[layer] : '';
}
