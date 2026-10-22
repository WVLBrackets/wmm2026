import { icons, type LucideIcon } from "lucide-react";

/** Lucide export names available to the vintage toolbar picker. */
export const VINTAGE_TOOLBAR_ICON_NAMES = Object.keys(icons).sort((a, b) =>
  a.localeCompare(b),
);

const CUSTOM_PREFIX = "custom:";

/**
 * Allow local paths or HTTPS URLs for uploaded toolbar SVGs.
 */
function safeIconUrl(value: string): boolean {
  if (/^\/(?![\/])[^\\\s]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * True when the toolbar icon points at an uploaded SVG (or other image URL).
 */
export function isCustomToolbarIcon(icon: string): boolean {
  return icon.startsWith(CUSTOM_PREFIX);
}

/**
 * Build a stored custom icon value from a public media URL.
 */
export function customToolbarIconValue(url: string): string {
  return `${CUSTOM_PREFIX}${url}`;
}

/**
 * Public URL for a custom toolbar icon, or null when Lucide.
 */
export function customToolbarIconUrl(icon: string): string | null {
  if (!isCustomToolbarIcon(icon)) return null;
  return icon.slice(CUSTOM_PREFIX.length);
}

/**
 * Resolve a stored Lucide icon name for toolbar rendering.
 */
export function resolveToolbarIcon(name: string): LucideIcon | null {
  if (!name || isCustomToolbarIcon(name)) return null;
  const Icon = icons[name as keyof typeof icons];
  return (Icon as LucideIcon | undefined) ?? null;
}

/**
 * True when blank (empty slot), a Lucide name, or a safe custom media URL.
 */
export function isAllowedToolbarIcon(name: string): boolean {
  if (!name) return true;
  if (isCustomToolbarIcon(name)) {
    const url = customToolbarIconUrl(name);
    return !!url && safeIconUrl(url);
  }
  return name in icons;
}
