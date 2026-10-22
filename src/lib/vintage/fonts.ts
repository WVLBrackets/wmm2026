/**
 * Curated fonts available in the vintage theme picker.
 * Self-hosted faces must keep matching @font-face rules in vintage.css.
 */
export interface VintageFontOption {
  id: string;
  label: string;
  /** CSS font-family stack applied when this option is selected. */
  stack: string;
  selfHosted?: boolean;
}

export const VINTAGE_FONT_OPTIONS: VintageFontOption[] = [
  {
    id: "Alfa Slab One",
    label: "Alfa Slab One",
    stack: '"Alfa Slab One", Georgia, serif',
    selfHosted: true,
  },
  {
    id: "Oswald",
    label: "Oswald",
    stack: "Oswald, Impact, sans-serif",
    selfHosted: true,
  },
  {
    id: "Arial",
    label: "Arial",
    stack: "Arial, Helvetica, sans-serif",
  },
  {
    id: "Helvetica",
    label: "Helvetica",
    stack: "Helvetica, Arial, sans-serif",
  },
  {
    id: "Georgia",
    label: "Georgia",
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "Times New Roman",
    label: "Times New Roman",
    stack: '"Times New Roman", Times, serif',
  },
  {
    id: "Verdana",
    label: "Verdana",
    stack: "Verdana, Geneva, sans-serif",
  },
  {
    id: "Trebuchet MS",
    label: "Trebuchet MS",
    stack: '"Trebuchet MS", Helvetica, sans-serif',
  },
];

const BY_ID = new Map(VINTAGE_FONT_OPTIONS.map((font) => [font.id, font]));

/**
 * Resolve a theme font id to a CSS font-family stack.
 */
export function resolveVintageFontStack(
  id: string,
  fallbackId: string,
): string {
  return (BY_ID.get(id) ?? BY_ID.get(fallbackId) ?? VINTAGE_FONT_OPTIONS[0])
    .stack;
}

/**
 * True when the id is in the vintage font catalog.
 */
export function isAllowedVintageFont(id: string): boolean {
  return BY_ID.has(id);
}
