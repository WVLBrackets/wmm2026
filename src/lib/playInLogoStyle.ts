import type { PlayInLogoLayout, PlayInLogoStyle } from '@/types/tournament';

export const PLAY_IN_LOGO_LAYOUTS: ReadonlyArray<{ value: PlayInLogoLayout; label: string }> = [
  { value: 'side-by-side', label: 'Side by side (half size)' },
  { value: 'corner-overlap', label: 'Corner overlap' },
  { value: 'corner-cut', label: 'Corner + diagonal cut' },
  { value: 'split-diagonal', label: 'Diagonal split (full size)' },
  { value: 'split-vertical', label: 'Vertical split (full size)' },
];

export const PLAY_IN_SCALE_MIN = 50;
export const PLAY_IN_SCALE_MAX = 90;
export const PLAY_IN_DIVIDER_MAX = 6;

export const DEFAULT_PLAY_IN_LOGO_STYLE: PlayInLogoStyle = {
  layout: 'corner-cut',
  scalePercent: 72,
  dividerWidth: 2,
};

/** Layouts where `scalePercent` changes the drawing. */
export function playInLayoutUsesScale(layout: PlayInLogoLayout): boolean {
  return layout === 'corner-overlap' || layout === 'corner-cut';
}

/**
 * Coerce stored / browser input into a valid style, filling defaults.
 *
 * @param value - Raw `display.playInLogo` value
 * @returns A clamped, complete style
 */
export function normalizePlayInLogoStyle(value: unknown): PlayInLogoStyle {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<PlayInLogoStyle>;
  const layout = PLAY_IN_LOGO_LAYOUTS.some((l) => l.value === input.layout)
    ? (input.layout as PlayInLogoLayout)
    : DEFAULT_PLAY_IN_LOGO_STYLE.layout;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  return {
    layout,
    scalePercent: clamp(input.scalePercent, PLAY_IN_SCALE_MIN, PLAY_IN_SCALE_MAX, DEFAULT_PLAY_IN_LOGO_STYLE.scalePercent),
    dividerWidth: clamp(input.dividerWidth, 0, PLAY_IN_DIVIDER_MAX, DEFAULT_PLAY_IN_LOGO_STYLE.dividerWidth),
  };
}

/** Escape a value for use inside a double-quoted XML attribute. */
function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const C = 64;

/**
 * Build the combined play-in tile as SVG markup on a 64×64 canvas.
 * Team A (first listed) is drawn on top / top-left; team B bottom-right.
 *
 * @param logos - Image hrefs for team A and B (data URI or same-origin path); null draws "?"
 * @param style - Layout settings (normalized internally)
 * @param idPrefix - Unique prefix for clip/filter ids when several SVGs are inlined on one page
 * @returns Standalone `<svg>` markup
 */
export function buildPlayInLogoSvg(
  logos: [string | null, string | null],
  style: PlayInLogoStyle,
  idPrefix = 'pi',
): string {
  const s = normalizePlayInLogoStyle(style);
  const id = idPrefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const w = s.dividerWidth;
  const scaled = Math.round((C * s.scalePercent) / 100);

  /** Box (x, y, size) for each logo by layout. */
  const boxes: [[number, number, number], [number, number, number]] =
    s.layout === 'side-by-side'
      ? [[0, 16, 32], [32, 16, 32]]
      : playInLayoutUsesScale(s.layout)
        ? [[0, 0, scaled], [C - scaled, C - scaled, scaled]]
        : [[0, 0, C], [0, 0, C]];

  const clips: [string, string] | null =
    s.layout === 'split-vertical'
      ? [`<rect x="0" y="0" width="${C / 2}" height="${C}"/>`, `<rect x="${C / 2}" y="0" width="${C / 2}" height="${C}"/>`]
      : s.layout === 'split-diagonal' || s.layout === 'corner-cut'
        ? [`<polygon points="0,0 ${C},0 0,${C}"/>`, `<polygon points="${C},0 ${C},${C} 0,${C}"/>`]
        : null;

  const halo = s.layout === 'corner-overlap' && w > 0;
  const defs = [
    clips ? `<clipPath id="${id}-a">${clips[0]}</clipPath><clipPath id="${id}-b">${clips[1]}</clipPath>` : '',
    halo
      ? `<filter id="${id}-halo" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="${w}" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      : '',
  ].join('');

  const draw = (index: 0 | 1) => {
    const [x, y, size] = boxes[index];
    const href = logos[index];
    const clip = clips ? ` clip-path="url(#${id}-${index === 0 ? 'a' : 'b'})"` : '';
    const filter = halo && index === 0 ? ` filter="url(#${id}-halo)"` : '';
    if (!href) {
      // Fallback "?" sits at the visible center of the logo's region.
      const cx = clips && boxes[index][2] === C ? (index === 0 ? C * 0.3 : C * 0.7) : x + size / 2;
      const cy = clips && boxes[index][2] === C ? (index === 0 ? C * 0.3 : C * 0.7) : y + size / 2;
      return `<text x="${cx}" y="${cy + size * 0.18}" text-anchor="middle" font-size="${Math.round(size * 0.5)}" font-family="Arial, sans-serif" fill="#152c3a">?</text>`;
    }
    return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${attr(href)}" preserveAspectRatio="xMidYMid meet"${clip}${filter}/>`;
  };

  const divider =
    w > 0 && s.layout === 'side-by-side'
      ? `<line x1="${C / 2}" y1="12" x2="${C / 2}" y2="${C - 12}" stroke="#fff" stroke-width="${w}"/>`
      : w > 0 && s.layout === 'split-vertical'
        ? `<line x1="${C / 2}" y1="0" x2="${C / 2}" y2="${C}" stroke="#fff" stroke-width="${w}"/>`
        : w > 0 && (s.layout === 'split-diagonal' || s.layout === 'corner-cut')
          ? `<line x1="${C}" y1="0" x2="0" y2="${C}" stroke="#fff" stroke-width="${w}"/>`
          : '';

  // B first so A (first-listed) wins any overlap.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}">${defs ? `<defs>${defs}</defs>` : ''}${draw(1)}${draw(0)}${divider}</svg>`;
}
