import {
  assertCopyLengths,
  assertNumberRange,
  formatCopy,
  normalizeCopyTree,
  type CopyTree,
} from "./copyTree";

/**
 * Bracket Editor Messages CMS section (`__bracketEditorContent`): every label,
 * validation message, and tie-breaker rule shown in the pick editor and
 * enforced by the submit API. Blank copy hides the element.
 */
export interface VintageBracketEditorContent extends CopyTree {
  brandStripLabel: string;
  /** Tokens: `{completed}`, `{total}`. */
  progressLabel: string;
  layoutLabel: string;
  layoutRegionsLabel: string;
  layoutFullLabel: string;
  entryNameLabel: string;
  entryNamePlaceholder: string;
  keyEntryLabel: string;
  /** Tokens: `{region}`. Desktop region title. */
  regionTitle: string;
  finalFourTitle: string;
  semifinal1Title: string;
  semifinal2Title: string;
  championshipTitle: string;
  /** Tokens: `{left}`, `{right}` (region names). Full-bracket finalist captions. */
  finalistPairingLabel: string;
  yourChampionLabel: string;
  championNotSelected: string;
  nextRegionAriaLabel: string;
  stepNavAriaLabel: string;
  /** Tokens: `{n}`. Used when a region has no name. */
  stepRegionFallback: string;
  stepCompleteLabel: string;
  stepIncompleteLabel: string;
  saveLabel: string;
  submitLabel: string;
  cancelLabel: string;
  closeLabel: string;
  submitReadyTooltip: string;
  regionalMessage: string;
  regionalMessageDone: string;
  finalFourDisabledMessage: string;
  teamsMissingMessage: string;
  entryNameMissingMessage: string;
  tieBreakerMissingMessage: string;
  /** Tokens: `{low}`, `{high}`. */
  tieBreakerInvalidMessage: string;
  completeBeforeSubmitMessage: string;
  readyToSubmitMessage: string;
  duplicateNameMessage: string;
  actionsDisabledMessage: string;
  tieBreakerLabel: string;
  /** `||` separates paragraphs. */
  tieBreakerHint: string;
  tieBreakerPlaceholder: string;
  tieBreakerHelpAriaLabel: string;
  tieBreakerHelpCloseAriaLabel: string;
  tieBreakerLow: number;
  tieBreakerHigh: number;
  /** Full-bracket canvas (editor, viewer, admin preview). */
  canvasEmptySlotLabel: string;
  canvasChampLabel: string;
  canvasTieBreakerLabel: string;
  /** Read-only bracket viewer popup (My Picks, Standings). */
  viewerFallbackTitle: string;
  viewerPrintLabel: string;
  viewerPrintAriaLabel: string;
  viewerCloseAriaLabel: string;
  viewerLoadingMessage: string;
  viewerLoadFailed: string;
  /** Printable bracket page. */
  printLoadingMessage: string;
  printUnavailableMessage: string;
  printBackLabel: string;
  printLabel: string;
  printCloseLabel: string;
  printVsLabel: string;
  printWinnerPlaceholder: string;
  /** Tokens: `{n}` (1 or 2). */
  printFinalistPlaceholder: string;
  /** Tokens: `{value}`. */
  printTieBreakerLabel: string;
}

/** Editor seed (matches the copy shipped before the CMS move). */
export const DEFAULT_VINTAGE_BRACKET_EDITOR_CONTENT: VintageBracketEditorContent = {
  brandStripLabel: "Bracket Editor",
  progressLabel: "{completed} of {total} picks",
  layoutLabel: "Layout",
  layoutRegionsLabel: "Regions",
  layoutFullLabel: "Full bracket",
  entryNameLabel: "Entry Name:",
  entryNamePlaceholder: "Enter your bracket name",
  keyEntryLabel: "KEY",
  regionTitle: "{region} Region",
  finalFourTitle: "Final Four",
  semifinal1Title: "Semifinal 1",
  semifinal2Title: "Semifinal 2",
  championshipTitle: "Championship",
  finalistPairingLabel: "{left} vs. {right}",
  yourChampionLabel: "Your Champion:",
  championNotSelected: "Not selected",
  nextRegionAriaLabel: "Next region",
  stepNavAriaLabel: "Bracket sections",
  stepRegionFallback: "Region {n}",
  stepCompleteLabel: "complete",
  stepIncompleteLabel: "not complete",
  saveLabel: "Save",
  submitLabel: "Submit",
  cancelLabel: "Cancel",
  closeLabel: "Close",
  submitReadyTooltip: "Submit your bracket",
  regionalMessage: "",
  regionalMessageDone: "",
  finalFourDisabledMessage:
    "Complete all four regions before you can work on the Final Four and championship.",
  teamsMissingMessage:
    "Please select winners for all Final Four and Championship games.",
  entryNameMissingMessage: "Please enter an entry name before submitting.",
  tieBreakerMissingMessage: "Please enter a tie breaker value.",
  tieBreakerInvalidMessage: "Tie breaker must be between {low} and {high}.",
  completeBeforeSubmitMessage: "Complete your bracket before submitting.",
  readyToSubmitMessage: "Your bracket is complete and ready to submit!",
  duplicateNameMessage:
    "An entry with this name already exists for this year. Please choose a different name.",
  actionsDisabledMessage: "Saving and submitting are temporarily disabled.",
  tieBreakerLabel: "TIEBREAKER: TOTAL POINTS",
  tieBreakerHint:
    "Predict the combined score of both teams in the championship game. Used to break ties.",
  tieBreakerPlaceholder: "TBD",
  tieBreakerHelpAriaLabel: "Tie breaker help",
  tieBreakerHelpCloseAriaLabel: "Close tie breaker help",
  tieBreakerLow: 50,
  tieBreakerHigh: 500,
  canvasEmptySlotLabel: "TBD",
  canvasChampLabel: "CHAMP",
  canvasTieBreakerLabel: "Tie Breaker",
  viewerFallbackTitle: "Bracket",
  viewerPrintLabel: "Print View",
  viewerPrintAriaLabel: "Open print layout in a new tab",
  viewerCloseAriaLabel: "Close",
  viewerLoadingMessage: "Loading bracket…",
  viewerLoadFailed: "This bracket could not be loaded. Please try again.",
  printLoadingMessage: "Preparing your printable bracket…",
  printUnavailableMessage: "No bracket data available.",
  printBackLabel: "Go Back",
  printLabel: "Print",
  printCloseLabel: "Close",
  printVsLabel: "VS",
  printWinnerPlaceholder: "Winner",
  printFinalistPlaceholder: "Finalist {n}",
  printTieBreakerLabel: "Tie Breaker (Finals Total) = {value}",
};

/**
 * Coerce stored JSON into the Bracket Editor Messages shape (editor seed fill).
 *
 * @param value - Raw sidecar JSON
 */
export function normalizeVintageBracketEditorContent(
  value: unknown,
): VintageBracketEditorContent {
  return normalizeCopyTree(value, DEFAULT_VINTAGE_BRACKET_EDITOR_CONTENT);
}

/**
 * Throw when the section is unusable (bad tie-breaker range or oversized copy).
 *
 * @param content - Normalized section
 */
export function validateVintageBracketEditorContent(
  content: VintageBracketEditorContent,
): void {
  assertNumberRange(
    content.tieBreakerLow,
    content.tieBreakerHigh,
    "Tie breaker range",
  );
  assertCopyLengths(content, 600);
}

/**
 * Fill `{token}` placeholders in a Bracket Editor Messages string.
 *
 * @param template - CMS copy
 * @param vars - Token values
 */
export function formatEditorCopy(
  template: string,
  vars: Record<string, string | number>,
): string {
  return formatCopy(template, vars);
}

/**
 * Tie-breaker invalid message with the configured range filled in.
 *
 * @param copy - Published Bracket Editor Messages
 */
export function formatTieBreakerInvalid(
  copy: Pick<
    VintageBracketEditorContent,
    "tieBreakerInvalidMessage" | "tieBreakerLow" | "tieBreakerHigh"
  >,
): string {
  return formatCopy(copy.tieBreakerInvalidMessage, {
    low: copy.tieBreakerLow,
    high: copy.tieBreakerHigh,
  });
}

/**
 * Tooltip text for tie-breaker help (`||` paragraphs → blank lines).
 *
 * @param hint - CMS `tieBreakerHint`
 */
export function tieBreakerHintTooltip(hint: string): string {
  return hint
    .split(/\|\|/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}
