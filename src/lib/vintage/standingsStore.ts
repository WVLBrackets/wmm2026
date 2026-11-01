import "server-only";
import { getPublishedCmsBundle } from "./cmsBundle";
import { hasVintageDatabase } from "./dbPool";
import {
  readVintageSectionState,
  writeVintageSection,
  type VintageSectionState,
} from "./sectionStore";
import type { SidecarWriteInput } from "./sidecarWriter";
import type { VintageStandingsContent } from "./standingsContent";

export type VintageStandingsState = VintageSectionState<VintageStandingsContent>;

export function hasVintageStandingsDatabase(): boolean {
  return hasVintageDatabase();
}

/** Standings copy draft/published for the admin editor. */
export async function readVintageStandingsState(): Promise<VintageStandingsState> {
  return readVintageSectionState("standings");
}

/** Published Standings copy (cached bundle; throws when CMS is unavailable). */
export async function getPublishedVintageStandingsContent(): Promise<VintageStandingsContent> {
  return (await getPublishedCmsBundle()).standings;
}

/** Save or publish Standings copy. */
export async function writeVintageStandingsContent(
  input: SidecarWriteInput<VintageStandingsContent>,
  _author: string,
): Promise<VintageStandingsState> {
  return writeVintageSection("standings", input);
}
