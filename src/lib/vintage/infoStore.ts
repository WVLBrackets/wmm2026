import "server-only";
import { getPublishedCmsBundle } from "./cmsBundle";
import { hasVintageDatabase } from "./dbPool";
import type { VintageInfoContent } from "./infoContent";
import {
  readVintageSectionState,
  writeVintageSection,
  type VintageSectionState,
} from "./sectionStore";
import type { SidecarWriteInput } from "./sidecarWriter";

export type VintageInfoState = VintageSectionState<VintageInfoContent>;

export function hasVintageInfoDatabase(): boolean {
  return hasVintageDatabase();
}

/** Handbook draft/published for the admin editor. */
export async function readVintageInfoState(): Promise<VintageInfoState> {
  return readVintageSectionState("info");
}

/** Published handbook (cached bundle; throws when CMS is unavailable). */
export async function getPublishedVintageInfoContent(): Promise<VintageInfoContent> {
  return (await getPublishedCmsBundle()).info;
}

/** Save or publish the handbook. */
export async function writeVintageInfoContent(
  input: SidecarWriteInput<VintageInfoContent>,
  _author: string,
): Promise<VintageInfoState> {
  return writeVintageSection("info", input);
}
