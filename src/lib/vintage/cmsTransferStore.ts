import { DEFAULT_VINTAGE_CONTENT } from "./content";
import {
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
 * Build an export package from the current vintage CMS database.
 */
export async function exportVintageCmsTransferBundle(
  sourceLabel?: string,
): Promise<VintageCmsTransferBundle> {
  const raw = await readVintageCmsRawDocuments();
  return buildVintageCmsTransferBundle({
    draft: raw.draft,
    published: raw.published,
    sourceLabel,
  });
}

/**
 * Diff an incoming package against the current environment (no writes).
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
    currentDraft: current.draft,
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
 * Replace draft + published CMS documents with the import package (after confirm).
 */
export async function applyVintageCmsTransfer(input: {
  version: number;
  bundle: unknown;
  expectedChangeCount: number;
}): Promise<{ version: number; appliedChanges: number }> {
  if (!hasVintageDatabase()) {
    throw new Error(
      "Dedicated vintage storage is not configured. Import was not applied.",
    );
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
      currentDraft: current.draft,
      currentPublished: current.published,
      incoming: bundle,
    });
    if (changes.length !== input.expectedChangeCount) {
      throw new Error(
        "CMS content changed since the preview. Review the import again.",
      );
    }
    const draftOut = mergeCmsDocumentBag(normalizeCmsDocumentBag(bundle.draft));
    const publishedOut = mergeCmsDocumentBag(
      normalizeCmsDocumentBag(bundle.published),
    );
    await client.query(
      "UPDATE vintage_homepage SET version = version + 1, draft = $1, published = $2 WHERE id = 1",
      [JSON.stringify(draftOut), JSON.stringify(publishedOut)],
    );
    await client.query("COMMIT");
    return {
      version: Number(current.version) + 1,
      appliedChanges: changes.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
