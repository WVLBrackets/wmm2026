/**
 * Site-wide CMS authoring convention: `||` is a hard line break.
 * Never show the pipes to visitors — split (or collapse to spaces) at render time.
 *
 * Apply to every visitor-facing CMS string unless it is a documented exception
 * (see GLOBAL_ENGINEERING_STANDARDS.md → CMS line breaks).
 */

/** Authoring token for an intentional line break in CMS copy. */
export const CMS_LINE_BREAK_TOKEN = "||" as const;

/** Short editor help for multiline CMS fields. */
export const CMS_LINE_BREAK_HINT =
  "Use || for a line break (never shows as punctuation on the public page).";

export type SplitCmsLinesOptions = {
  /** Trim each segment (default true). */
  trim?: boolean;
  /** Drop empty segments after trim (default true). */
  dropEmpty?: boolean;
  /**
   * Cap line count; extra segments fold onto the last line joined by spaces.
   * Used by fitted art (footer captions ≤2, champ names ≤3, TOC ≤2).
   */
  maxLines?: number;
};

/**
 * Split CMS copy on `||` into display lines.
 *
 * @param raw - Author string (may include tokens already resolved)
 * @param options - Trim / empty / max-lines behavior
 */
export function splitCmsLines(
  raw: string,
  options?: SplitCmsLinesOptions,
): string[] {
  const trim = options?.trim !== false;
  const dropEmpty = options?.dropEmpty !== false;
  let parts = String(raw ?? "").split(CMS_LINE_BREAK_TOKEN);
  if (trim) {
    parts = parts.map((part) => part.trim());
  }
  if (dropEmpty) {
    parts = parts.filter(Boolean);
  }
  const max = options?.maxLines;
  if (typeof max === "number" && max > 0 && parts.length > max) {
    const head = parts.slice(0, max - 1);
    const tail = parts.slice(max - 1).join(" ");
    return [...head, tail];
  }
  return parts;
}

/**
 * One-line form of CMS copy: `||` becomes a single space.
 * Use for aria-labels, titles, button labels, and other single-line chrome.
 *
 * @param raw - Author string
 */
export function cmsPlainText(raw: string): string {
  return splitCmsLines(raw).join(" ");
}

/**
 * True when the author embedded at least one `||` break token.
 *
 * @param raw - Author string
 */
export function hasCmsLineBreak(raw: string): boolean {
  return String(raw ?? "").includes(CMS_LINE_BREAK_TOKEN);
}
