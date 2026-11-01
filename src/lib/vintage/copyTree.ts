/**
 * Shape helpers for flat/nested CMS copy sections (Emails & Account,
 * Bracket Editor Messages, Scoreboard).
 *
 * `DEFAULT_*` templates are editor seeds only. Public reads use
 * {@link blankMissingStrings} so a field that was never stored renders as
 * blank (hidden) rather than silently falling back to code copy.
 */

export type CopyLeaf = string | number | boolean;
export interface CopyTree {
  [key: string]: CopyLeaf | CopyTree;
}

/**
 * Coerce stored JSON into the template's shape. Missing or wrong-typed leaves
 * take the template value (editor seed behavior).
 *
 * @param value - Raw stored JSON (any shape)
 * @param template - Default seed describing the expected shape
 * @returns A fresh object matching `template`'s shape
 */
export function normalizeCopyTree<T extends CopyTree>(
  value: unknown,
  template: T,
): T {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = {};
  for (const [key, seed] of Object.entries(template)) {
    const raw = input[key];
    if (typeof seed === "string") {
      out[key] = typeof raw === "string" ? raw : seed;
    } else if (typeof seed === "number") {
      out[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : seed;
    } else if (typeof seed === "boolean") {
      out[key] = typeof raw === "boolean" ? raw : seed;
    } else {
      out[key] = normalizeCopyTree(raw, seed);
    }
  }
  return out as T;
}

/**
 * Blank every string leaf in `normalized` whose path is absent from `raw`.
 * Non-string leaves (numbers, booleans) and array shapes are left as-is.
 *
 * @param normalized - Output of a section's normalize function
 * @param raw - The stored JSON that was normalized
 * @returns `normalized` with never-stored copy replaced by `""`
 */
export function blankMissingStrings<T>(normalized: T, raw: unknown): T {
  if (typeof normalized === "string") {
    return (typeof raw === "string" ? normalized : "") as T;
  }
  if (Array.isArray(normalized)) {
    const rawArr = Array.isArray(raw) ? raw : [];
    return normalized.map((item, i) =>
      blankMissingStrings(item, rawArr[i]),
    ) as T;
  }
  if (normalized && typeof normalized === "object") {
    const rawObj =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(
      normalized as Record<string, unknown>,
    )) {
      out[key] = blankMissingStrings(val, rawObj[key]);
    }
    return out as T;
  }
  return normalized;
}

/**
 * Replace `{token}` placeholders. Unknown tokens are left untouched.
 *
 * @param template - CMS copy with `{name}` tokens
 * @param vars - Token values
 */
export function formatCopy(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key)
      ? String(vars[key])
      : match,
  );
}

/**
 * Throw when a numeric range pair is invalid.
 *
 * @param low - Lower bound
 * @param high - Upper bound
 * @param label - Field label for the error
 */
export function assertNumberRange(
  low: number,
  high: number,
  label: string,
): void {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high <= low) {
    throw new Error(`${label}: low must be ≥ 0 and less than high.`);
  }
}

/**
 * Throw when any string leaf exceeds `max` characters.
 *
 * @param tree - Section content
 * @param max - Max characters per leaf
 * @param path - Internal recursion prefix
 */
export function assertCopyLengths(
  tree: CopyTree,
  max: number,
  path = "",
): void {
  for (const [key, val] of Object.entries(tree)) {
    const next = path ? `${path}.${key}` : key;
    if (typeof val === "string") {
      if (val.length > max) throw new Error(`${next} is too long (max ${max}).`);
    } else if (val && typeof val === "object") {
      assertCopyLengths(val, max, next);
    }
  }
}
