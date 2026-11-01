import "server-only";
import { getPublishedCmsBundle } from "./cmsBundle";
import { hasVintageDatabase } from "./dbPool";
import type { VintageHofContent } from "./hofContent";
import {
  readVintageSectionState,
  writeVintageSection,
  type VintageSectionState,
} from "./sectionStore";
import type { SidecarWriteInput } from "./sidecarWriter";

export type VintageHofState = VintageSectionState<VintageHofContent>;

export function hasVintageHofDatabase(): boolean {
  return hasVintageDatabase();
}

/** Hall of Fame copy draft/published for the admin editor. */
export async function readVintageHofState(): Promise<VintageHofState> {
  return readVintageSectionState("hof");
}

/** Published Hall of Fame copy (cached bundle; throws when CMS is unavailable). */
export async function getPublishedVintageHofContent(): Promise<VintageHofContent> {
  return (await getPublishedCmsBundle()).hof;
}

/** Save or publish Hall of Fame copy. */
export async function writeVintageHofContent(
  input: SidecarWriteInput<VintageHofContent>,
  _author: string,
): Promise<VintageHofState> {
  return writeVintageSection("hof", input);
}
