import { getVintageDbPool, hasVintageDatabase } from "./dbPool";
import { splitHomepageDocument } from "./homepageDocument";
import {
  DEFAULT_VINTAGE_STANDINGS_CONTENT,
  normalizeVintageStandingsContent,
  type VintageStandingsContent,
  validateVintageStandingsContent,
} from "./standingsContent";
import { writeVintageSidecarContent } from "./sidecarWriter";

export interface VintageStandingsState {
  version: number;
  draft: VintageStandingsContent;
  published: VintageStandingsContent;
}

const EMPTY = (): VintageStandingsState => ({
  version: 0,
  draft: structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
  published: structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT),
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
  return {
    version: Number(row.version),
    draft: draftStandings,
    published: publishedStandings,
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
 * Save or publish Standings copy on the shared homepage row.
 */
export async function writeVintageStandingsContent(
  input: {
    action: "save" | "publish";
    version: number;
    content: VintageStandingsContent;
  },
  _author: string,
): Promise<VintageStandingsState> {
  await writeVintageSidecarContent<VintageStandingsContent>({
    slot: "standings",
    input,
    normalizeSidecar: normalizeVintageStandingsContent,
    validateSidecar: validateVintageStandingsContent,
    readPublishedSidecar: (publishedRow) =>
      normalizeVintageStandingsContent(
        splitHomepageDocument(publishedRow).standings,
      ),
  });
  return readVintageStandingsState();
}
