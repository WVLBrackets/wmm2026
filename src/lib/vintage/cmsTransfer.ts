import {
  normalizeVintageContent,
  validateVintageContent,
  type VintageContent,
} from "./content";
import {
  HOF_CONTENT_KEY,
  INFO_HANDBOOK_KEY,
  PICKS_CONTENT_KEY,
  STANDINGS_CONTENT_KEY,
  mergeHomepageDocument,
  splitHomepageDocument,
} from "./homepageDocument";
import {
  normalizeVintageHofContent,
  validateVintageHofContent,
  type VintageHofContent,
} from "./hofContent";
import {
  normalizeVintageInfoContent,
  validateVintageInfoContent,
  type VintageInfoContent,
} from "./infoContent";
import {
  normalizeVintagePicksContent,
  validateVintagePicksContent,
  type VintagePicksContent,
} from "./picksContent";
import {
  normalizeVintageStandingsContent,
  validateVintageStandingsContent,
  type VintageStandingsContent,
} from "./standingsContent";

/** Bundle format version for export/import packages. */
export const CMS_TRANSFER_SCHEMA_VERSION = 1;

export const CMS_TRANSFER_KIND = "vintage-cms-transfer" as const;

export type CmsTransferDesk =
  | "home"
  | "guidebook"
  | "hof"
  | "standings"
  | "picks";

export type CmsTransferEdition = "draft" | "published";

/**
 * Portable CMS package: full draft + published documents (homepage + sidecars).
 */
export interface VintageCmsTransferBundle {
  schemaVersion: number;
  kind: typeof CMS_TRANSFER_KIND;
  exportedAt: string;
  /** Optional label (e.g. local, staging) — display only. */
  sourceLabel?: string;
  draft: Record<string, unknown>;
  published: Record<string, unknown>;
}

/**
 * One leaf-level field difference between current env and an import package.
 */
export interface CmsFieldChange {
  desk: CmsTransferDesk;
  edition: CmsTransferEdition;
  path: string;
  before: string;
  after: string;
}

/**
 * Normalized CMS document bag used for transfer and diffs.
 */
export interface VintageCmsDocumentBag {
  homepage: VintageContent;
  info: VintageInfoContent;
  hof: VintageHofContent;
  picks: VintagePicksContent;
  standings: VintageStandingsContent;
}

const DESK_LABELS: Record<CmsTransferDesk, string> = {
  home: "Home",
  guidebook: "Guidebook",
  hof: "Hall of Fame",
  standings: "Standings",
  picks: "Picks",
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
  if (path === INFO_HANDBOOK_KEY || path.startsWith(`${INFO_HANDBOOK_KEY}.`)) {
    return "guidebook";
  }
  if (path === HOF_CONTENT_KEY || path.startsWith(`${HOF_CONTENT_KEY}.`)) {
    return "hof";
  }
  if (path === PICKS_CONTENT_KEY || path.startsWith(`${PICKS_CONTENT_KEY}.`)) {
    return "picks";
  }
  if (
    path === STANDINGS_CONTENT_KEY ||
    path.startsWith(`${STANDINGS_CONTENT_KEY}.`)
  ) {
    return "standings";
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
    return value === "" ? '(empty string)' : value;
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
  const split = splitHomepageDocument(raw);
  const homepage = normalizeVintageContent(split.homepage);
  const info = normalizeVintageInfoContent(split.info);
  const hof = normalizeVintageHofContent(split.hof);
  const picks = normalizeVintagePicksContent(split.picks);
  const standings = normalizeVintageStandingsContent(split.standings);
  validateVintageContent(homepage);
  validateVintageInfoContent(info);
  validateVintageHofContent(hof);
  validateVintagePicksContent(picks);
  validateVintageStandingsContent(standings);
  return { homepage, info, hof, picks, standings };
}

/**
 * Merge desk bags back into a single JSON document for storage.
 */
export function mergeCmsDocumentBag(
  bag: VintageCmsDocumentBag,
): Record<string, unknown> {
  return mergeHomepageDocument(
    bag.homepage,
    bag.info,
    bag.hof,
    bag.picks,
    bag.standings,
  );
}

/**
 * Parse and validate an uploaded CMS transfer package.
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
  if (record.schemaVersion !== CMS_TRANSFER_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported CMS package schemaVersion ${String(record.schemaVersion)} (expected ${CMS_TRANSFER_SCHEMA_VERSION}).`,
    );
  }
  if (!record.draft || typeof record.draft !== "object" || Array.isArray(record.draft)) {
    throw new Error("CMS package is missing a draft document.");
  }
  if (
    !record.published ||
    typeof record.published !== "object" ||
    Array.isArray(record.published)
  ) {
    throw new Error("CMS package is missing a published document.");
  }
  // Validate by normalizing both editions.
  normalizeCmsDocumentBag(record.draft);
  normalizeCmsDocumentBag(record.published);
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
    draft: mergeCmsDocumentBag(normalizeCmsDocumentBag(record.draft)),
    published: mergeCmsDocumentBag(normalizeCmsDocumentBag(record.published)),
  };
}

/**
 * Build a portable export package from raw DB draft/published rows.
 */
export function buildVintageCmsTransferBundle(input: {
  draft: unknown;
  published: unknown;
  sourceLabel?: string;
}): VintageCmsTransferBundle {
  return {
    schemaVersion: CMS_TRANSFER_SCHEMA_VERSION,
    kind: CMS_TRANSFER_KIND,
    exportedAt: new Date().toISOString(),
    sourceLabel: input.sourceLabel?.trim().slice(0, 80) || undefined,
    draft: mergeCmsDocumentBag(normalizeCmsDocumentBag(input.draft)),
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
  return changes.filter((c) => formatTransferLeaf(c.before) !== formatTransferLeaf(c.after));
}

/**
 * Compare an import package to the current environment’s draft and published rows.
 */
export function diffCmsTransferBundle(input: {
  currentDraft: unknown;
  currentPublished: unknown;
  incoming: VintageCmsTransferBundle;
}): CmsFieldChange[] {
  const currentDraft = mergeCmsDocumentBag(
    normalizeCmsDocumentBag(input.currentDraft),
  );
  const currentPublished = mergeCmsDocumentBag(
    normalizeCmsDocumentBag(input.currentPublished),
  );
  const incomingDraft = input.incoming.draft;
  const incomingPublished = input.incoming.published;

  const out: CmsFieldChange[] = [];

  for (const leaf of diffJsonLeaves(currentDraft, incomingDraft)) {
    out.push({
      desk: deskForTransferPath(leaf.path),
      edition: "draft",
      path: leaf.path,
      before: formatTransferLeaf(leaf.before),
      after: formatTransferLeaf(leaf.after),
    });
  }
  for (const leaf of diffJsonLeaves(currentPublished, incomingPublished)) {
    out.push({
      desk: deskForTransferPath(leaf.path),
      edition: "published",
      path: leaf.path,
      before: formatTransferLeaf(leaf.before),
      after: formatTransferLeaf(leaf.after),
    });
  }

  const deskOrder: CmsTransferDesk[] = [
    "home",
    "guidebook",
    "hof",
    "standings",
    "picks",
  ];
  out.sort((a, b) => {
    const desk = deskOrder.indexOf(a.desk) - deskOrder.indexOf(b.desk);
    if (desk !== 0) return desk;
    if (a.edition !== b.edition) {
      return a.edition === "published" ? -1 : 1;
    }
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
  draftCount: number;
  publishedCount: number;
} {
  const byDesk: Record<CmsTransferDesk, number> = {
    home: 0,
    guidebook: 0,
    hof: 0,
    standings: 0,
    picks: 0,
  };
  let draftCount = 0;
  let publishedCount = 0;
  for (const change of changes) {
    byDesk[change.desk] += 1;
    if (change.edition === "draft") draftCount += 1;
    else publishedCount += 1;
  }
  return { total: changes.length, byDesk, draftCount, publishedCount };
}
