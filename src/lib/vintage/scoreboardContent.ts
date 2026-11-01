import {
  assertCopyLengths,
  formatCopy,
  normalizeCopyTree,
  type CopyTree,
} from "./copyTree";

/** Scoreboard CMS section (`__scoreboardContent`): public page labels. */
export interface VintageScoreboardContent extends CopyTree {
  heading: string;
  loadingMessage: string;
  /** Tokens: `{time}`. */
  updatedLabel: string;
  yearLabel: string;
  groupLabel: string;
  groupsAriaLabel: string;
  /** Tokens: `{count}`. */
  groupCountLabel: string;
  /** Tokens: `{count}`. */
  gameCountSingular: string;
  /** Tokens: `{count}`. */
  gameCountPlural: string;
  liveTitle: string;
  upcomingTitle: string;
  finalTitle: string;
  finalEmptyMessage: string;
  /** Tokens: `{group}`. */
  previousLabel: string;
  /** Tokens: `{group}`. */
  nextLabel: string;
  previousNoneLabel: string;
  nextNoneLabel: string;
  mobilePreviousLabel: string;
  mobileNextLabel: string;
  statusFinal: string;
  statusLive: string;
  statusUpcoming: string;
  teamTbd: string;
  timeTbd: string;
  editLabel: string;
  closeEditorLabel: string;
}

/** Editor seed (copy shipped before the CMS move). */
export const DEFAULT_VINTAGE_SCOREBOARD_CONTENT: VintageScoreboardContent = {
  heading: "Scoreboard",
  loadingMessage: "Loading scoreboard…",
  updatedLabel: "Updated {time}",
  yearLabel: "Scoreboard year",
  groupLabel: "Group",
  groupsAriaLabel: "Scoreboard groups",
  groupCountLabel: "{count} tournament groups",
  gameCountSingular: "{count} game",
  gameCountPlural: "{count} games",
  liveTitle: "Live",
  upcomingTitle: "Upcoming",
  finalTitle: "Final",
  finalEmptyMessage: "No completed games yet.",
  previousLabel: "Previous: {group}",
  nextLabel: "Next: {group} →",
  previousNoneLabel: "Previous: (none)",
  nextNoneLabel: "Next: (none)",
  mobilePreviousLabel: "← Previous",
  mobileNextLabel: "Next →",
  statusFinal: "FINAL",
  statusLive: "LIVE",
  statusUpcoming: "UPCOMING",
  teamTbd: "TBD",
  timeTbd: "TIME TBD",
  editLabel: "Edit scoreboard",
  closeEditorLabel: "Close scoreboard editor",
};

/**
 * Coerce stored JSON into the Scoreboard shape (editor seed fill).
 *
 * @param value - Raw sidecar JSON
 */
export function normalizeVintageScoreboardContent(
  value: unknown,
): VintageScoreboardContent {
  return normalizeCopyTree(value, DEFAULT_VINTAGE_SCOREBOARD_CONTENT);
}

/**
 * Throw when any field is oversized.
 *
 * @param content - Normalized section
 */
export function validateVintageScoreboardContent(
  content: VintageScoreboardContent,
): void {
  assertCopyLengths(content, 300);
}

/**
 * Fill `{token}` placeholders in Scoreboard copy.
 *
 * @param template - CMS copy
 * @param vars - Token values
 */
export function formatScoreboardCopy(
  template: string,
  vars: Record<string, string | number>,
): string {
  return formatCopy(template, vars);
}
