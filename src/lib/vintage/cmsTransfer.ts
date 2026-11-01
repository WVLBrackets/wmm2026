import {
  validateVintageContent,
  type VintageContent,
} from "./content";
import {
  SIDECAR_KEYS,
  SIDECAR_SLOTS,
  mergeHomepageDocument,
  type SidecarSlot,
} from "./homepageDocument";
import {
  SIDECAR_CODECS,
  homepageFromRow,
  sidecarsFromRow,
  type VintageSidecarBag,
} from "./sidecarPreserve";

/**
 * Bundle format version — v2 is published-only (v1 packages still import via
 * their `published` document; `draft` is ignored).
 */
export const CMS_TRANSFER_SCHEMA_VERSION = 2;

export const CMS_TRANSFER_KIND = "vintage-cms-transfer" as const;

export type CmsTransferDesk =
  | "home"
  | "guidebook"
  | "hof"
  | "standings"
  | "picks"
  | "emails"
  | "bracketEditor"
  | "scoreboard";

/** Sidecar slot → transfer desk. */
const SLOT_DESK: Record<SidecarSlot, CmsTransferDesk> = {
  info: "guidebook",
  hof: "hof",
  picks: "picks",
  standings: "standings",
  emails: "emails",
  bracketEditor: "bracketEditor",
  scoreboard: "scoreboard",
};

/** Desk display order in diffs and summaries. */
const DESK_ORDER: CmsTransferDesk[] = [
  "home",
  "guidebook",
  "hof",
  "standings",
  "picks",
  "emails",
  "bracketEditor",
  "scoreboard",
];

/**
 * Portable CMS package: published document only (homepage + sidecars).
 */
export interface VintageCmsTransferBundle {
  schemaVersion: number;
  kind: typeof CMS_TRANSFER_KIND;
  exportedAt: string;
  /** Optional label (e.g. local, staging) — display only. */
  sourceLabel?: string;
  published: Record<string, unknown>;
}

/**
 * One leaf-level field difference between current published and an import package.
 */
export interface CmsFieldChange {
  desk: CmsTransferDesk;
  path: string;
  before: string;
  after: string;
}

/**
 * Normalized CMS document bag used for transfer and diffs.
 */
export interface VintageCmsDocumentBag extends VintageSidecarBag {
  homepage: VintageContent;
}

const DESK_LABELS: Record<CmsTransferDesk, string> = {
  home: "Home",
  guidebook: "Guidebook",
  hof: "Hall of Fame",
  standings: "Standings",
  picks: "Picks",
  emails: "Emails & Account",
  bracketEditor: "Bracket Editor Messages",
  scoreboard: "Scoreboard",
};

/**
 * Human label for a CMS desk.
 */
export function cmsTransferDeskLabel(desk: CmsTransferDesk): string {
  return DESK_LABELS[desk];
}

/**
 * Map a dotted transfer path to its admin desk.
 */
export function deskForTransferPath(path: string): CmsTransferDesk {
  for (const slot of SIDECAR_SLOTS) {
    const key = SIDECAR_KEYS[slot];
    if (path === key || path.startsWith(`${key}.`)) return SLOT_DESK[slot];
  }
  return "home";
}

/**
 * Pretty-print a leaf value for the import review table.
 */
export function formatTransferLeaf(value: unknown): string {
  if (value === undefined) return "(missing)";
  if (value === null) return "null";
  if (typeof value === "string") {
    if (value.length > 280) return `${value.slice(0, 277)}…`;
    return value === "" ? "(empty string)" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    if (json.length > 280) return `${json.slice(0, 277)}…`;
    return json;
  } catch {
    return String(value);
  }
}

/**
 * Normalize a raw homepage row (with sidecars) into validated desk bags.
 */
export function normalizeCmsDocumentBag(raw: unknown): VintageCmsDocumentBag {
  const homepage = homepageFromRow(raw);
  validateVintageContent(homepage);
  const sides = sidecarsFromRow(raw);
  for (const slot of SIDECAR_SLOTS) {
    (SIDECAR_CODECS[slot].validate as (c: unknown) => void)(sides[slot]);
  }
  return { homepage, ...sides };
}

/**
 * Merge desk bags back into a single JSON document for storage.
 */
export function mergeCmsDocumentBag(
  bag: VintageCmsDocumentBag,
): Record<string, unknown> {
  const { homepage, ...sides } = bag;
  return mergeHomepageDocument(homepage, sides);
}

/**
 * Parse a dotted/bracket path into object keys and array indexes.
 */
export function parseTransferPath(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path))) {
    if (match[1] != null) segments.push(match[1]);
    else if (match[2] != null) segments.push(Number(match[2]));
  }
  if (segments.length === 0) {
    throw new Error(`Invalid CMS field path: ${path}`);
  }
  return segments;
}

/**
 * Read a value at a transfer path (undefined if missing).
 */
export function getAtTransferPath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const segment of parseTransferPath(path)) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    if (typeof segment === "number") {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[segment];
    } else {
      cursor = (cursor as Record<string, unknown>)[segment];
    }
  }
  return cursor;
}

/**
 * Immutably set a value at a transfer path (creates objects/arrays as needed).
 */
export function setAtTransferPath(
  root: unknown,
  path: string,
  value: unknown,
): unknown {
  const segments = parseTransferPath(path);

  const setAt = (node: unknown, index: number): unknown => {
    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (typeof segment === "number") {
      const arr = Array.isArray(node) ? [...node] : [];
      while (arr.length <= segment) arr.push(undefined);
      arr[segment] = isLast ? value : setAt(arr[segment], index + 1);
      return arr;
    }

    const obj =
      node !== null && typeof node === "object" && !Array.isArray(node)
        ? { ...(node as Record<string, unknown>) }
        : {};
    obj[segment] = isLast ? value : setAt(obj[segment], index + 1);
    return obj;
  };

  return setAt(root, 0);
}

/**
 * Parse and validate an uploaded CMS transfer package (published only).
 * Accepts schema v1 (ignores `draft`) and v2.
 */
export function parseVintageCmsTransferBundle(
  raw: unknown,
): VintageCmsTransferBundle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("CMS package must be a JSON object.");
  }
  const record = raw as Record<string, unknown>;
  if (record.kind !== CMS_TRANSFER_KIND) {
    throw new Error(
      'CMS package kind must be "vintage-cms-transfer". Export from Vintage Admin first.',
    );
  }
  const version = Number(record.schemaVersion);
  if (version !== 1 && version !== CMS_TRANSFER_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported CMS package schemaVersion ${String(record.schemaVersion)} (expected 1 or ${CMS_TRANSFER_SCHEMA_VERSION}).`,
    );
  }
  if (
    !record.published ||
    typeof record.published !== "object" ||
    Array.isArray(record.published)
  ) {
    throw new Error("CMS package is missing a published document.");
  }
  return {
    schemaVersion: CMS_TRANSFER_SCHEMA_VERSION,
    kind: CMS_TRANSFER_KIND,
    exportedAt:
      typeof record.exportedAt === "string" && record.exportedAt.trim()
        ? record.exportedAt
        : new Date().toISOString(),
    sourceLabel:
      typeof record.sourceLabel === "string" && record.sourceLabel.trim()
        ? record.sourceLabel.trim().slice(0, 80)
        : undefined,
    published: mergeCmsDocumentBag(normalizeCmsDocumentBag(record.published)),
  };
}

/**
 * Build a portable export package from the published CMS row.
 */
export function buildVintageCmsTransferBundle(input: {
  published: unknown;
  sourceLabel?: string;
}): VintageCmsTransferBundle {
  return {
    schemaVersion: CMS_TRANSFER_SCHEMA_VERSION,
    kind: CMS_TRANSFER_KIND,
    exportedAt: new Date().toISOString(),
    sourceLabel: input.sourceLabel?.trim().slice(0, 80) || undefined,
    published: mergeCmsDocumentBag(normalizeCmsDocumentBag(input.published)),
  };
}

/**
 * Deep-diff two JSON values into leaf path changes (arrays compared as wholes
 * when both sides are arrays, unless every element is a plain object keyed by index).
 */
export function diffJsonLeaves(
  before: unknown,
  after: unknown,
  basePath = "",
): { path: string; before: unknown; after: unknown }[] {
  const changes: { path: string; before: unknown; after: unknown }[] = [];

  const walk = (a: unknown, b: unknown, path: string) => {
    if (Object.is(a, b)) return;
    const aObj =
      a !== null && typeof a === "object" && !Array.isArray(a)
        ? (a as Record<string, unknown>)
        : null;
    const bObj =
      b !== null && typeof b === "object" && !Array.isArray(b)
        ? (b as Record<string, unknown>)
        : null;

    if (aObj && bObj) {
      const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
      for (const key of [...keys].sort()) {
        const next = path ? `${path}.${key}` : key;
        walk(aObj[key], bObj[key], next);
      }
      return;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      const max = Math.max(a.length, b.length);
      let allPlainObjects = true;
      for (let i = 0; i < max; i++) {
        const ai = a[i];
        const bi = b[i];
        const bothObjects =
          (ai === undefined ||
            (ai !== null && typeof ai === "object" && !Array.isArray(ai))) &&
          (bi === undefined ||
            (bi !== null && typeof bi === "object" && !Array.isArray(bi)));
        if (!bothObjects) {
          allPlainObjects = false;
          break;
        }
      }
      if (allPlainObjects && max > 0) {
        for (let i = 0; i < max; i++) {
          walk(a[i], b[i], `${path}[${i}]`);
        }
        return;
      }
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      changes.push({ path, before: a, after: b });
      return;
    }

    changes.push({ path, before: a, after: b });
  };

  walk(before, after, basePath);
  return changes.filter(
    (c) => formatTransferLeaf(c.before) !== formatTransferLeaf(c.after),
  );
}

/**
 * Compare an import package’s published document to the current published row.
 */
export function diffCmsTransferBundle(input: {
  currentPublished: unknown;
  incoming: VintageCmsTransferBundle;
}): CmsFieldChange[] {
  const currentPublished = mergeCmsDocumentBag(
    normalizeCmsDocumentBag(input.currentPublished),
  );
  const incomingPublished = input.incoming.published;

  const out: CmsFieldChange[] = [];
  for (const leaf of diffJsonLeaves(currentPublished, incomingPublished)) {
    out.push({
      desk: deskForTransferPath(leaf.path),
      path: leaf.path,
      before: formatTransferLeaf(leaf.before),
      after: formatTransferLeaf(leaf.after),
    });
  }

  out.sort((a, b) => {
    const desk = DESK_ORDER.indexOf(a.desk) - DESK_ORDER.indexOf(b.desk);
    if (desk !== 0) return desk;
    return a.path.localeCompare(b.path);
  });
  return out;
}

/**
 * Summarize change counts by desk for the confirm UI.
 */
export function summarizeCmsTransferChanges(changes: CmsFieldChange[]): {
  total: number;
  byDesk: Record<CmsTransferDesk, number>;
} {
  const byDesk = Object.fromEntries(
    DESK_ORDER.map((desk) => [desk, 0]),
  ) as Record<CmsTransferDesk, number>;
  for (const change of changes) {
    byDesk[change.desk] += 1;
  }
  return { total: changes.length, byDesk };
}

/**
 * Apply selected leaf paths from an incoming published document onto the
 * current published document. Unselected paths keep the current values.
 */
export function applySelectedPublishedPatches(input: {
  currentPublished: unknown;
  incomingPublished: unknown;
  selectedPaths: string[];
}): Record<string, unknown> {
  let next: unknown = mergeCmsDocumentBag(
    normalizeCmsDocumentBag(input.currentPublished),
  );
  const incoming = mergeCmsDocumentBag(
    normalizeCmsDocumentBag(input.incomingPublished),
  );
  const uniquePaths = [...new Set(input.selectedPaths)];
  for (const path of uniquePaths) {
    next = setAtTransferPath(next, path, getAtTransferPath(incoming, path));
  }
  return mergeCmsDocumentBag(normalizeCmsDocumentBag(next));
}
