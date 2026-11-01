import { DEFAULT_VINTAGE_CONTENT } from "./content";
import {
  applySelectedPublishedPatches,
  buildVintageCmsTransferBundle,
  diffCmsTransferBundle,
  mergeCmsDocumentBag,
  normalizeCmsDocumentBag,
  parseVintageCmsTransferBundle,
  summarizeCmsTransferChanges,
  type CmsFieldChange,
  type VintageCmsTransferBundle,
} from "./cmsTransfer";
import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { revalidateVintageCms } from "./sidecarWriter";

/**
 * Read the raw draft/published homepage row (including sidecars) for transfer.
 */
export async function readVintageCmsRawDocuments(): Promise<{
  version: number;
  draft: unknown;
  published: unknown;
}> {
  if (!hasVintageDatabase()) {
    const empty = mergeCmsDocumentBag(
      normalizeCmsDocumentBag(DEFAULT_VINTAGE_CONTENT),
    );
    return { version: 0, draft: empty, published: empty };
  }
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const row = result.rows[0];
  if (!row) {
    const empty = mergeCmsDocumentBag(
      normalizeCmsDocumentBag(DEFAULT_VINTAGE_CONTENT),
    );
    return { version: 0, draft: empty, published: empty };
  }
  return {
    version: Number(row.version),
    draft: row.draft,
    published: row.published,
  };
}

/**
 * Build an export package from the current published CMS document.
 */
export async function exportVintageCmsTransferBundle(
  sourceLabel?: string,
): Promise<VintageCmsTransferBundle> {
  const raw = await readVintageCmsRawDocuments();
  return buildVintageCmsTransferBundle({
    published: raw.published,
    sourceLabel,
  });
}

/**
 * Diff an incoming package’s published document against current published (no writes).
 */
export async function previewVintageCmsTransfer(rawBundle: unknown): Promise<{
  version: number;
  changes: CmsFieldChange[];
  summary: ReturnType<typeof summarizeCmsTransferChanges>;
  bundle: VintageCmsTransferBundle;
}> {
  const bundle = parseVintageCmsTransferBundle(rawBundle);
  const current = await readVintageCmsRawDocuments();
  const changes = diffCmsTransferBundle({
    currentPublished: current.published,
    incoming: bundle,
  });
  return {
    version: current.version,
    changes,
    summary: summarizeCmsTransferChanges(changes),
    bundle,
  };
}

/**
 * Patch selected published leaf paths from the import package.
 * Draft is left unchanged. Paths not listed keep the current published values.
 */
export async function applyVintageCmsTransfer(input: {
  version: number;
  bundle: unknown;
  expectedChangeCount: number;
  selectedPaths: string[];
}): Promise<{ version: number; appliedChanges: number }> {
  if (!hasVintageDatabase()) {
    throw new Error(
      "Dedicated vintage storage is not configured. Import was not applied.",
    );
  }
  if (!Array.isArray(input.selectedPaths)) {
    throw new Error("Apply requires selectedPaths (array of field paths).");
  }
  const bundle = parseVintageCmsTransferBundle(input.bundle);
  const client = await getVintageDbPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO vintage_homepage (id, version, draft, published) VALUES (1, 0, $1, $1) ON CONFLICT DO NOTHING",
      [JSON.stringify(DEFAULT_VINTAGE_CONTENT)],
    );
    const result = await client.query(
      "SELECT version, draft, published FROM vintage_homepage WHERE id = 1 FOR UPDATE",
    );
    const current = result.rows[0];
    if (Number(current.version) !== input.version) {
      throw new Error("CONFLICT");
    }
    const changes = diffCmsTransferBundle({
      currentPublished: current.published,
      incoming: bundle,
    });
    if (changes.length !== input.expectedChangeCount) {
      throw new Error(
        "CMS content changed since the preview. Review the import again.",
      );
    }
    const allowed = new Set(changes.map((c) => c.path));
    const selected = [...new Set(input.selectedPaths)];
    for (const path of selected) {
      if (!allowed.has(path)) {
        throw new Error(
          `Selected path is not in the current published diff: ${path}`,
        );
      }
    }
    const publishedOut = applySelectedPublishedPatches({
      currentPublished: current.published,
      incomingPublished: bundle.published,
      selectedPaths: selected,
    });
    await client.query(
      "UPDATE vintage_homepage SET version = version + 1, published = $1 WHERE id = 1",
      [JSON.stringify(publishedOut)],
    );
    await client.query("COMMIT");
    revalidateVintageCms();
    return {
      version: Number(current.version) + 1,
      appliedChanges: selected.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
