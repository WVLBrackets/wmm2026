import {
  normalizeVintageBracketEditorContent,
  validateVintageBracketEditorContent,
  type VintageBracketEditorContent,
} from "./bracketEditorContent";
import {
  normalizeVintageContent,
  type VintageContent,
} from "./content";
import {
  normalizeVintageEmailsContent,
  validateVintageEmailsContent,
  type VintageEmailsContent,
} from "./emailsContent";
import {
  normalizeVintageHofContent,
  validateVintageHofContent,
  type VintageHofContent,
} from "./hofContent";
import {
  SIDECAR_SLOTS,
  splitHomepageDocument,
  type SidecarSlot,
} from "./homepageDocument";
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
  normalizeVintageScoreboardContent,
  validateVintageScoreboardContent,
  type VintageScoreboardContent,
} from "./scoreboardContent";
import { rawHomepageHasKeyData } from "./seasonKeyData";
import {
  normalizeVintageStandingsContent,
  validateVintageStandingsContent,
  type VintageStandingsContent,
} from "./standingsContent";

/** Every CMS sidecar, normalized. */
export interface VintageSidecarBag {
  info: VintageInfoContent;
  hof: VintageHofContent;
  picks: VintagePicksContent;
  standings: VintageStandingsContent;
  emails: VintageEmailsContent;
  bracketEditor: VintageBracketEditorContent;
  scoreboard: VintageScoreboardContent;
}

type Codec<T> = {
  normalize: (value: unknown) => T;
  validate: (content: T) => void;
};

/** Normalize/validate pair for each sidecar slot. */
export const SIDECAR_CODECS: { [K in SidecarSlot]: Codec<VintageSidecarBag[K]> } = {
  info: { normalize: normalizeVintageInfoContent, validate: validateVintageInfoContent },
  hof: { normalize: normalizeVintageHofContent, validate: validateVintageHofContent },
  picks: { normalize: normalizeVintagePicksContent, validate: validateVintagePicksContent },
  standings: {
    normalize: normalizeVintageStandingsContent,
    validate: validateVintageStandingsContent,
  },
  emails: { normalize: normalizeVintageEmailsContent, validate: validateVintageEmailsContent },
  bracketEditor: {
    normalize: normalizeVintageBracketEditorContent,
    validate: validateVintageBracketEditorContent,
  },
  scoreboard: {
    normalize: normalizeVintageScoreboardContent,
    validate: validateVintageScoreboardContent,
  },
};

/**
 * Normalize every sidecar on a row (missing sections are seeded from the
 * editor defaults so any write completes the document).
 *
 * @param raw - Stored `draft` or `published` JSON
 */
export function sidecarsFromRow(raw: unknown): VintageSidecarBag {
  const split = splitHomepageDocument(raw);
  const out = {} as Record<SidecarSlot, unknown>;
  for (const slot of SIDECAR_SLOTS) {
    out[slot] = SIDECAR_CODECS[slot].normalize(split[slot]);
  }
  return out as unknown as VintageSidecarBag;
}

/**
 * Normalize the homepage fragment of a row. Legacy rows that never stored
 * Key Data inherit season gates from the same row's My Picks sidecar.
 *
 * @param raw - Stored `draft` or `published` JSON
 */
export function homepageFromRow(raw: unknown): VintageContent {
  const split = splitHomepageDocument(raw);
  const home = normalizeVintageContent(split.homepage);
  if (rawHomepageHasKeyData(split.homepage) || split.picks == null) return home;
  const picks = normalizeVintagePicksContent(split.picks);
  return {
    ...home,
    keyData: {
      ...home.keyData,
      bracketsPublished: picks.bracketsPublished,
      entryCost: picks.entryCost,
      masterLockUnlocked: picks.masterLockUnlocked,
      masterLockMessage:
        picks.masterLockMessage?.trim() || home.keyData.masterLockMessage,
    },
  };
}
