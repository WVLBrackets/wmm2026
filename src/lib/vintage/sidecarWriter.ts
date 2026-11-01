import { revalidateTag } from "next/cache";
import { DEFAULT_VINTAGE_CONTENT, validateVintageContent } from "./content";
import { getVintageDbPool } from "./dbPool";
import { mergeHomepageDocument, type SidecarSlot } from "./homepageDocument";
import {
  SIDECAR_CODECS,
  homepageFromRow,
  sidecarsFromRow,
  type VintageSidecarBag,
} from "./sidecarPreserve";

export type CmsWriteAction = "save" | "publish";

export interface SidecarWriteInput<T> {
  action: CmsWriteAction;
  version: number;
  content: T;
}

/** Cache tag for every published-CMS read (see `cmsBundle.ts`). */
export const VINTAGE_CMS_TAG = "vintage-cms";

/**
 * Invalidate cached published CMS reads after any write. Safe to call
 * outside a request (scripts) — failures are ignored.
 */
export function revalidateVintageCms(): void {
  try {
    revalidateTag(VINTAGE_CMS_TAG);
    revalidateTag("site-config");
  } catch {
    /* not in a Next.js request context */
  }
}

/**
 * Build complete draft/published documents from a locked row, applying
 * `patch` to both. Every section is normalized so the row is fully stored.
 *
 * @param current - Locked `vintage_homepage` row
 * @param patch - Mutates the normalized draft/published bags in place
 */
export function rebuildHomepageRow(
  current: { draft: unknown; published: unknown },
  patch: (docs: {
    draft: { home: ReturnType<typeof homepageFromRow>; sides: VintageSidecarBag };
    published: { home: ReturnType<typeof homepageFromRow>; sides: VintageSidecarBag };
  }) => void,
): { draft: Record<string, unknown>; published: Record<string, unknown> } {
  const docs = {
    draft: { home: homepageFromRow(current.draft), sides: sidecarsFromRow(current.draft) },
    published: {
      home: homepageFromRow(current.published),
      sides: sidecarsFromRow(current.published),
    },
  };
  patch(docs);
  validateVintageContent(docs.draft.home);
  validateVintageContent(docs.published.home);
  return {
    draft: mergeHomepageDocument(docs.draft.home, docs.draft.sides),
    published: mergeHomepageDocument(docs.published.home, docs.published.sides),
  };
}

/**
 * Run `fn` against the locked homepage row inside a transaction and persist
 * the documents it returns.
 *
 * @param expectedVersion - Optimistic-lock version (`null` skips the check)
 * @param fn - Builds the next draft/published documents
 */
export async function withLockedHomepageRow(
  expectedVersion: number | null,
  fn: (current: { version: number; draft: unknown; published: unknown }) => {
    draft: Record<string, unknown>;
    published: Record<string, unknown>;
  },
): Promise<void> {
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
    const row = result.rows[0];
    const current = {
      version: Number(row.version),
      draft: row.draft,
      published: row.published,
    };
    if (expectedVersion !== null && current.version !== expectedVersion) {
      throw new Error("CONFLICT");
    }
    const next = fn(current);
    await client.query(
      "UPDATE vintage_homepage SET version = version + 1, draft = $1, published = $2 WHERE id = 1",
      [JSON.stringify(next.draft), JSON.stringify(next.published)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  revalidateVintageCms();
}

/**
 * Transactional write for one CMS sidecar on `vintage_homepage`.
 * Draft is always replaced; published only on `publish`.
 *
 * @param slot - Sidecar to write
 * @param input - Action, optimistic version, and content
 */
export async function writeVintageSidecarContent<K extends SidecarSlot>(
  slot: K,
  input: SidecarWriteInput<VintageSidecarBag[K]>,
): Promise<void> {
  const codec = SIDECAR_CODECS[slot];
  const normalized = codec.normalize(input.content);
  codec.validate(normalized);
  await withLockedHomepageRow(input.version, (current) =>
    rebuildHomepageRow(current, (docs) => {
      docs.draft.sides[slot] = normalized;
      if (input.action === "publish") docs.published.sides[slot] = normalized;
    }),
  );
}
