import "server-only";
import { getPublishedCmsBundle } from "./cmsBundle";
import { hasVintageDatabase } from "./dbPool";
import type { VintagePicksContent } from "./picksContent";
import {
  readVintageSectionState,
  writeVintageSection,
  type VintageSectionState,
} from "./sectionStore";
import type { SidecarWriteInput } from "./sidecarWriter";

export type VintagePicksState = VintageSectionState<VintagePicksContent>;

export function hasVintagePicksDatabase(): boolean {
  return hasVintageDatabase();
}

/** My Picks copy draft/published for the admin editor. */
export async function readVintagePicksState(): Promise<VintagePicksState> {
  return readVintageSectionState("picks");
}

/** Published My Picks copy (cached bundle; throws when CMS is unavailable). */
export async function getPublishedVintagePicksContent(): Promise<VintagePicksContent> {
  return (await getPublishedCmsBundle()).picks;
}

/** Save or publish My Picks copy. */
export async function writeVintagePicksContent(
  input: SidecarWriteInput<VintagePicksContent>,
  _author: string,
): Promise<VintagePicksState> {
  return writeVintageSection("picks", input);
}
