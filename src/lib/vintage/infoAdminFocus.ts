/**
 * Deep-link targets for the Tournament Handbook editor.
 */
export type VintageInfoAdminFocus =
  | { kind: "intro" }
  | { kind: "facts" }
  | { kind: "entry" }
  | { kind: "scoring" }
  | { kind: "prizes" }
  | { kind: "tracker" }
  | { kind: "questions" };

export const VINTAGE_INFO_ADMIN_PATH = "/vintage/admin/info";

/** Editor tab labels (must match VintageInfoEditor `tabs`). */
export const VINTAGE_INFO_EDITOR_TAB = {
  intro: "Introduction",
  facts: "Quick facts",
  entry: "Entry & payment",
  scoring: "Scoring",
  prizes: "Prizes",
  tracker: "Tracker",
  questions: "Questions",
  revisions: "Revisions",
} as const;

/**
 * Build a handbook editor URL that opens a specific section.
 */
export function vintageInfoAdminEditHref(focus: VintageInfoAdminFocus): string {
  return `${VINTAGE_INFO_ADMIN_PATH}?focus=${encodeURIComponent(focus.kind)}`;
}

/**
 * Parse `?focus=` from the handbook editor URL.
 */
export function parseVintageInfoAdminFocus(
  focus: string | null | undefined,
): VintageInfoAdminFocus | null {
  switch (focus) {
    case "intro":
    case "facts":
    case "entry":
    case "scoring":
    case "prizes":
    case "tracker":
    case "questions":
      return { kind: focus };
    default:
      return null;
  }
}

/**
 * Map a focus kind to its editor tab label.
 */
export function infoFocusToTab(
  focus: VintageInfoAdminFocus,
): (typeof VINTAGE_INFO_EDITOR_TAB)[keyof typeof VINTAGE_INFO_EDITOR_TAB] {
  return VINTAGE_INFO_EDITOR_TAB[focus.kind];
}
