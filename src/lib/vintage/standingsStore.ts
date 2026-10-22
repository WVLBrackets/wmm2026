import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import {
  isStandingsRevisionContent,
  splitHomepageDocument,
  unwrapStandingsRevisionContent,
  wrapStandingsRevisionContent,
} from "./homepageDocument";
import {
  DEFAULT_VINTAGE_STANDINGS_CONTENT,
  normalizeVintageStandingsContent,
  type VintageStandingsContent,
  validateVintageStandingsContent,
} from "./standingsContent";
import { writeVintageSidecarContent } from "./sidecarWriter";
import type { VintageRevision } from "./store";

export interface VintageStandingsState {
  version: number;
  draft: VintageStandingsContent;
  published: VintageStandingsContent;
  revisions: VintageRevision[];
}

const EMPTY = (): VintageStandingsState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
  revisions: [],
});

export function hasVintageStandingsDatabase(): boolean {
  return hasVintageDatabase();
}

/**
 * Read Standings copy draft/published from the homepage row sidecar.
 */
export async function readVintageStandingsState(): Promise<VintageStandingsState> {
  if (!hasVintageStandingsDatabase()) return EMPTY();
  const result = await getVintageDbPool().query(
    "SELECT version, draft, published FROM vintage_homepage WHERE id = 1",
  );
  const revisions = await getVintageDbPool().query(
    'SELECT id, created_at AS "createdAt", author, action, content FROM vintage_homepage_revisions ORDER BY created_at DESC LIMIT 40',
  );
  const row = result.rows[0];
  if (!row) return EMPTY();
  const draftStandings = normalizeVintageStandingsContent(
    splitHomepageDocument(row.draft).standings,
  );
  const publishedStandings = normalizeVintageStandingsContent(
    splitHomepageDocument(row.published).standings,
  );
  validateVintageStandingsContent(draftStandings);
  validateVintageStandingsContent(publishedStandings);
  const standingsRevisions = revisions.rows
    .filter((item) => isStandingsRevisionContent(item.content))
    .slice(0, 20)
    .map(({ id, createdAt, author, action }) => ({
      id,
      createdAt,
      author,
      action,
    }));
  return {
    version: Number(row.version),
    draft: draftStandings,
    published: publishedStandings,
    revisions: standingsRevisions,
  };
}

/**
 * Published Standings copy for the primary-admin Live Standings page.
 */
export async function getPublishedVintageStandingsContent(): Promise<VintageStandingsContent> {
  try {
    return (await readVintageStandingsState()).published;
  } catch (error) {
    console.error(
      "[Vintage Standings] Published content unavailable:",
      error instanceof Error ? error.message : "storage error",
    );
    return structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT);
  }
}

/**
 * Save / publish / restore Standings copy on the shared homepage row.
 */
export async function writeVintageStandingsContent(
  input: {
    action: "save" | "publish" | "restore";
    version: number;
    content?: VintageStandingsContent;
    revisionId?: string;
  },
  author: string,
): Promise<VintageStandingsState> {
  await writeVintageSidecarContent<VintageStandingsContent>({
    slot: "standings",
    input,
    author,
    isRevisionContent: isStandingsRevisionContent,
    unwrapRevision: unwrapStandingsRevisionContent,
    wrapRevision: wrapStandingsRevisionContent,
    wrongRevisionMessage: "That revision is not a Standings copy revision.",
    normalizeSidecar: normalizeVintageStandingsContent,
    validateSidecar: validateVintageStandingsContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintageStandingsContent(
        splitHomepageDocument(publishedRow).standings,
      ),
  });
  return readVintageStandingsState();
}
