/**
 * CMS copy for the vintage Live Standings page (not ranking data —
 * that stays in live_standings_snapshots).
 *
 * Logo sizing, result colors, and result hover / aria phrases are also
 * consumed by My Picks — edit once here, apply on both pages.
 * Year 2020 uses nested `paper2020` newspaper copy (no standings table).
 */

import {
  DEFAULT_PICK_RESULT_A11Y_PHRASES,
  type PickResultA11yPhrases,
} from "@/lib/pickResultChrome";

/**
 * One-page 2020 pandemic cancellation newspaper (Standings year=2020).
 */
export interface VintageStandingsPaper2020 {
  /** Masthead title above the article, e.g. "2020 Edition". */
  pageHeading: string;
  /** Line under the masthead title. */
  pageSubhead: string;
  /** Dateline kicker, e.g. "Special Edition · March 2020". */
  kicker: string;
  /** Volume line, e.g. "Vol. XX · No. Bracket". */
  volume: string;
  /** Main headline. */
  headline: string;
  /** Deck under the headline. */
  deck: string;
  /** Lead column subhead. */
  leadSubhead: string;
  /** Lead column first paragraph. */
  leadBody1: string;
  /** Lead column second paragraph. */
  leadBody2: string;
  /** Sidebar subhead. */
  sidebarSubhead: string;
  /** Sidebar body paragraph. */
  sidebarBody: string;
  /** Pull quote text (without surrounding quotes if you include them). */
  pullQuote: string;
  /** Pull quote attribution, e.g. "— Dan Gavitt". */
  pullCite: string;
  /** Warren’s desk / wire subhead. */
  wireSubhead: string;
  /** Warren’s desk body. */
  wireBody: string;
  /** Sources intro before the first link, e.g. "Sources: ". */
  sourcesIntro: string;
  /** First source link label. */
  source1Label: string;
  /** First source URL. */
  source1Href: string;
  /** Text between sources, e.g. "; contemporary anniversary discussion on ". */
  sourcesBetween: string;
  /** Second source link label. */
  source2Label: string;
  /** Second source URL. */
  source2Href: string;
  /** Text after the second link, e.g. ".". */
  sourcesOutro: string;
  /**
   * Hide flags — `"true"` / `"false"`. When true, that article section is
   * omitted on the public 2020 newspaper (copy is retained in CMS).
   */
  hidePageSubhead: string;
  hideDateline: string;
  hideHeadline: string;
  hideLead: string;
  hideSidebar: string;
  hideWire: string;
  hideSources: string;
}

/**
 * Normalize a CMS true/false flag (default false when unset).
 */
function normalizePaperHideFlag(value: unknown): string {
  if (typeof value !== "string") return "false";
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return "true";
  return "false";
}

/**
 * Whether a 2020 newspaper hide flag is on.
 */
export function isPaper2020SectionHidden(flag: string | undefined): boolean {
  return String(flag ?? "")
    .trim()
    .toLowerCase() === "true";
}

export const DEFAULT_VINTAGE_STANDINGS_PAPER_2020: VintageStandingsPaper2020 = {
  pageHeading: "2020 Edition",
  pageSubhead: "Tournament cancelled — no final standings",
  kicker: "Special Edition · March 2020",
  volume: "Vol. XX · No. Bracket",
  headline: "NCAA Cancels Men’s Basketball Championship",
  deck: "March Madness called off amid coronavirus crisis — no brackets, no Final Four, no national champion.",
  leadSubhead: "Thursday, March 12",
  leadBody1:
    "NCAA President Mark Emmert and the Board of Governors cancelled the Division I men’s and women’s 2020 basketball tournaments, along with all remaining winter and spring NCAA championships. The decision cited the evolving COVID-19 public health threat and the impracticality of hosting events during the academic year.",
  leadBody2:
    "One day earlier, the NCAA had planned to play with only essential staff and limited family attendance. Conference tournaments were already collapsing across the map. By Thursday night, the season was over.",
  sidebarSubhead: "No brackets released",
  sidebarBody:
    "On March 15, NCAA Senior Vice President of Basketball Dan Gavitt confirmed there would be no selection shows and no official brackets. Selection work had barely begun; dozens of conference tournaments never finished. Hypothetical fields, he said, would not be fair or credible.",
  pullQuote:
    "There will always be an asterisk next to the 2020 NCAA men’s and women’s basketball championships.",
  pullCite: "— Dan Gavitt",
  wireSubhead: "Warren’s desk",
  wireBody:
    "For the first time in our history, Warren’s March Madness has no standings to print. There was no tipoff, no KEY, and no champion to crown. Fans still remember where they were when the news hit — an empty March that should have been filled with brackets.",
  sourcesIntro: "Sources: ",
  source1Label: "NCAA.com live updates",
  source1Href:
    "https://www.ncaa.com/live-updates/basketball-men/d1/ncaa-cancels-mens-and-womens-basketball-championships-due",
  sourcesBetween: "; contemporary anniversary discussion on ",
  source2Label: "r/CollegeBasketball",
  source2Href:
    "https://www.reddit.com/r/CollegeBasketball/comments/1bd2u2m/4_years_ago_today_the_ncaa_cancelled_the_2020/",
  sourcesOutro: ".",
  hidePageSubhead: "false",
  hideDateline: "false",
  hideHeadline: "false",
  hideLead: "false",
  hideSidebar: "false",
  hideWire: "false",
  hideSources: "false",
};

/**
 * Normalize 2020 newspaper CMS fields from defaults.
 */
export function normalizeVintageStandingsPaper2020(
  value: unknown,
): VintageStandingsPaper2020 {
  const defaults = structuredClone(DEFAULT_VINTAGE_STANDINGS_PAPER_2020);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const input = value as Partial<VintageStandingsPaper2020>;
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof VintageStandingsPaper2020)[]) {
    if (typeof input[key] === "string") next[key] = input[key] as string;
  }
  next.hidePageSubhead = normalizePaperHideFlag(next.hidePageSubhead);
  next.hideDateline = normalizePaperHideFlag(next.hideDateline);
  next.hideHeadline = normalizePaperHideFlag(next.hideHeadline);
  next.hideLead = normalizePaperHideFlag(next.hideLead);
  next.hideSidebar = normalizePaperHideFlag(next.hideSidebar);
  next.hideWire = normalizePaperHideFlag(next.hideWire);
  next.hideSources = normalizePaperHideFlag(next.hideSources);
  return next;
}

/**
 * Validate 2020 newspaper CMS before save/publish.
 */
export function validateVintageStandingsPaper2020(
  value: unknown,
): asserts value is VintageStandingsPaper2020 {
  const doc = normalizeVintageStandingsPaper2020(value);
  if (!doc.headline.trim()) {
    throw new Error("2020 newspaper headline cannot be blank.");
  }
  if (!doc.pageHeading.trim()) {
    throw new Error("2020 newspaper page heading cannot be blank.");
  }
}

export interface VintageStandingsContent {
  /** Page title, e.g. "Standings". */
  heading: string;
  /**
   * Default year for the standings year selector (not Tourney Year).
   * Four-digit string, e.g. "2026".
   */
  standingsYear: string;
  /**
   * Text prepended to the snapshot timestamp, e.g. "Updated" or
   * "Standings last updated".
   */
  updatedLabel: string;
  /** Search input placeholder. */
  searchPlaceholder: string;
  /** All Entries filter label. */
  filterAllLabel: string;
  /** My Entries filter label. */
  filterMineLabel: string;
  /** Badge next to the signed-in user's entries (desktop). */
  yoursBadgeLabel: string;
  /**
   * Show paid glyph next to entry names. `"true"` / `"false"`.
   */
  showPaidIndicator: string;
  /** Glyph for paid entries (default `$`). */
  paidGlyph: string;
  /** Accessible / title text for the paid glyph. */
  paidAriaLabel: string;
  /** Desktop Rank column header. */
  colRankHeader: string;
  /** Desktop Entry column header. */
  colEntryHeader: string;
  /** Desktop Paid column header. */
  colPaidHeader: string;
  /** Desktop Points column header. */
  colPointsHeader: string;
  /** Desktop Gap column header. */
  colGapHeader: string;
  /** Desktop TB column header. */
  colTbHeader: string;
  /** Desktop Final Four column header. */
  colFinalFourHeader: string;
  /** Desktop Champion column header. */
  colChampHeader: string;
  /** Mobile Rank column header (short), e.g. `#`. */
  colRankHeaderMobile: string;
  /** Mobile Entry column header. */
  colEntryHeaderMobile: string;
  /** Mobile Paid column header, e.g. `PAID`. */
  colPaidHeaderMobile: string;
  /** Mobile Final Four column header (short), e.g. `FF`. */
  colFinalFourHeaderMobile: string;
  /** Mobile Champ column header (short), e.g. `Ch.`. */
  colChampHeaderMobile: string;
  /** Empty state when no snapshot/KEY for the year. */
  notAvailableMessage: string;
  /** Search yielded no rows. */
  noSearchResultsMessage: string;
  /** My Entries filter with zero owned brackets. */
  noMyEntriesMessage: string;
  /** Footer count template. Tokens: {shown}, {total}. */
  showingCountTemplate: string;
  /** Compact legend — Final Four / Champ. */
  legendFinalFourChamp: string;
  /** Compact legend — black finalist frame. */
  legendFinalistFrame: string;
  /** Compact legend — YOURS badge and paid glyph. Blank hides the line. */
  legendYoursPaid: string;
  /**
   * Hover / screen-reader fallback when a Final Four cell has no team
   * (Standings + My Picks).
   */
  a11yEmptySelection: string;
  /** Hover / screen-reader fallback when champion is unset. */
  a11yNoChampionPick: string;
  /** Shade correct — regional Final Four cell. */
  a11yCorrectRegional: string;
  /** Shade incorrect / eliminated — regional Final Four cell. */
  a11yIncorrectRegional: string;
  /** Shade correct — champion cell. */
  a11yCorrectChampion: string;
  /** Shade incorrect / eliminated — champion cell. */
  a11yIncorrectChampion: string;
  /** Finalist frame correct vs KEY semi. */
  a11yCorrectFinalist: string;
  /** Finalist frame incorrect / eliminated vs KEY semi. */
  a11yIncorrectFinalist: string;
  /** Shared pending phrase (any column still undecided). */
  a11yPending: string;
  /**
   * Separate from shade — heavy frame means the entry picked this team
   * to reach the final.
   */
  a11yFinalistFrame: string;
  /** Desktop Final Four logo tile size in px (square), e.g. "22". */
  finalFourLogoSizeDesktopPx: string;
  /** Desktop Champion logo tile size in px (square), e.g. "28". */
  champLogoSizeDesktopPx: string;
  /** Mobile Final Four logo tile size in px (square), e.g. "22". */
  finalFourLogoSizeMobilePx: string;
  /** Mobile Champion logo tile size in px (square), e.g. "28". */
  champLogoSizeMobilePx: string;
  /** My Picks mobile card Final Four tile size in px (square), e.g. "26". */
  finalFourLogoSizeCardPx: string;
  /** My Picks mobile card Champion tile size in px (square), e.g. "39". */
  champLogoSizeCardPx: string;
  /** Logo image size as a percent of its tile (both columns), e.g. "100". */
  logoFillPercent: string;
  /** Finalist black frame border width in px, e.g. "2". */
  finalistBorderWidthPx: string;
  /** Cell fill when pick is correct (KEY matches). */
  shadeCorrect: string;
  /** Cell fill when pick is wrong or eliminated. */
  shadeIncorrect: string;
  /** Cell fill when game not decided and pick still alive. */
  shadePending: string;
  /** Finalist / result border when pick is correct. */
  borderCorrect: string;
  /** Finalist / result border when pick is wrong or eliminated. */
  borderIncorrect: string;
  /** Finalist border when semi not decided and pick still alive. */
  borderPendingFinalist: string;
  /** Accessible name for the Gap column. */
  gapColumnAriaLabel: string;
  /** Year select aria label. Token: {year}. */
  yearSelectAriaLabel: string;
  /** 2020 cancellation newspaper (Standings year selector → 2020). */
  paper2020: VintageStandingsPaper2020;
}

/** String-only Standings CMS keys (excludes nested paper2020). */
export type VintageStandingsStringKey = {
  [K in keyof VintageStandingsContent]: VintageStandingsContent[K] extends string
    ? K
    : never;
}[keyof VintageStandingsContent];

export const DEFAULT_VINTAGE_STANDINGS_CONTENT: VintageStandingsContent = {
  heading: "Standings",
  standingsYear: "2026",
  updatedLabel: "Updated",
  searchPlaceholder: "Search entries...",
  filterAllLabel: "All Entries",
  filterMineLabel: "My Entries",
  yoursBadgeLabel: "YOURS",
  showPaidIndicator: "true",
  paidGlyph: "$",
  paidAriaLabel: "Paid",
  colRankHeader: "#",
  colEntryHeader: "Entry",
  colPaidHeader: "PAID",
  colPointsHeader: "Points",
  colGapHeader: "Back",
  colTbHeader: "TB",
  colFinalFourHeader: "Final Four",
  colChampHeader: "Champ",
  colRankHeaderMobile: "#",
  colEntryHeaderMobile: "Entry",
  colPaidHeaderMobile: "PAID",
  colFinalFourHeaderMobile: "FF",
  colChampHeaderMobile: "Champ",
  notAvailableMessage:
    "Live standings are not available for {year} yet. Check back after the field is set.",
  noSearchResultsMessage: "No entries match your search.",
  noMyEntriesMessage: "You have no entries in this year's standings.",
  showingCountTemplate: "Showing {shown} of {total} entries",
  legendFinalFourChamp:
    "Final Four: your 4 selections | Champ.: your champion pick",
  legendFinalistFrame: "Black frame = picked to reach the final",
  legendYoursPaid: "YOURS = your entries · $ = paid entry",
  a11yEmptySelection: DEFAULT_PICK_RESULT_A11Y_PHRASES.emptySelection,
  a11yNoChampionPick: DEFAULT_PICK_RESULT_A11Y_PHRASES.noChampionPick,
  a11yCorrectRegional: DEFAULT_PICK_RESULT_A11Y_PHRASES.correctRegional,
  a11yIncorrectRegional: DEFAULT_PICK_RESULT_A11Y_PHRASES.incorrectRegional,
  a11yCorrectChampion: DEFAULT_PICK_RESULT_A11Y_PHRASES.correctChampion,
  a11yIncorrectChampion: DEFAULT_PICK_RESULT_A11Y_PHRASES.incorrectChampion,
  a11yCorrectFinalist: DEFAULT_PICK_RESULT_A11Y_PHRASES.correctFinalist,
  a11yIncorrectFinalist: DEFAULT_PICK_RESULT_A11Y_PHRASES.incorrectFinalist,
  a11yPending: DEFAULT_PICK_RESULT_A11Y_PHRASES.pending,
  a11yFinalistFrame: DEFAULT_PICK_RESULT_A11Y_PHRASES.finalistFrame,
  finalFourLogoSizeDesktopPx: "32",
  champLogoSizeDesktopPx: "42",
  finalFourLogoSizeMobilePx: "32",
  champLogoSizeMobilePx: "42",
  finalFourLogoSizeCardPx: "26",
  champLogoSizeCardPx: "39",
  logoFillPercent: "100",
  finalistBorderWidthPx: "2",
  shadeCorrect: "#dcfce7",
  shadeIncorrect: "#fee2e2",
  shadePending: "#ffffff",
  borderCorrect: "#16a34a",
  borderIncorrect: "#dc2626",
  borderPendingFinalist: "#000000",
  gapColumnAriaLabel: "Points behind the leader",
  yearSelectAriaLabel: "Viewing year {year}. Change standings year",
  paper2020: structuredClone(DEFAULT_VINTAGE_STANDINGS_PAPER_2020),
};

/**
 * Accept a CSS color string or fall back to default.
 */
function normalizeCssColor(value: string, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  // Allow hex, rgb(), hsl(), or named colors — keep short and safe.
  if (v.length > 64) return fallback;
  if (/^[a-zA-Z#(),.%0-9\s-]+$/.test(v)) return v;
  return fallback;
}

const LOGO_SIZE_MIN = 12;
const LOGO_SIZE_MAX = 64;
const BORDER_WIDTH_MIN = 1;
const BORDER_WIDTH_MAX = 8;
const LOGO_FILL_MIN = 50;
const LOGO_FILL_MAX = 100;

/**
 * Parse a CMS px size string into a clamped integer (or fallback).
 */
export function parseStandingsPx(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Resolved logo / border sizes from Standings CMS (clamped).
 * Desktop and mobile Final Four / Champ sizes are independent.
 */
export function resolveStandingsLogoSizing(copy: VintageStandingsContent): {
  finalFourDesktopPx: number;
  champDesktopPx: number;
  finalFourMobilePx: number;
  champMobilePx: number;
  finalFourCardPx: number;
  champCardPx: number;
  logoFillPercent: number;
  finalistBorderPx: number;
} {
  return {
    finalFourDesktopPx: parseStandingsPx(
      copy.finalFourLogoSizeDesktopPx,
      32,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
    champDesktopPx: parseStandingsPx(
      copy.champLogoSizeDesktopPx,
      42,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
    finalFourMobilePx: parseStandingsPx(
      copy.finalFourLogoSizeMobilePx,
      32,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
    champMobilePx: parseStandingsPx(
      copy.champLogoSizeMobilePx,
      42,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
    finalFourCardPx: parseStandingsPx(
      copy.finalFourLogoSizeCardPx,
      26,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
    champCardPx: parseStandingsPx(
      copy.champLogoSizeCardPx,
      39,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
    logoFillPercent: parseStandingsPx(
      copy.logoFillPercent,
      100,
      LOGO_FILL_MIN,
      LOGO_FILL_MAX,
    ),
    finalistBorderPx: parseStandingsPx(
      copy.finalistBorderWidthPx,
      2,
      BORDER_WIDTH_MIN,
      BORDER_WIDTH_MAX,
    ),
  };
}

/**
 * Treat CMS flag strings as on unless explicitly false-ish.
 */
export function isStandingsFlagOn(value: string | undefined | null): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return true;
  return !(v === "false" || v === "no" || v === "0" || v === "off");
}

/**
 * Fill missing Standings CMS fields from defaults.
 * Migrates legacy `gapColumnHeader` into `colGapHeader` when present.
 */
export function normalizeVintageStandingsContent(
  value: unknown,
): VintageStandingsContent {
  const defaults = structuredClone(DEFAULT_VINTAGE_STANDINGS_CONTENT);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const input = value as Partial<VintageStandingsContent> & {
    gapColumnHeader?: string;
    /** Legacy single-size fields (pre desktop/mobile split). */
    finalFourLogoSizePx?: string;
    champLogoSizePx?: string;
  };
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof VintageStandingsContent)[]) {
    if (key === "paper2020") continue;
    if (typeof input[key] === "string") next[key] = input[key] as string;
  }
  next.paper2020 = normalizeVintageStandingsPaper2020(
    (input as { paper2020?: unknown }).paper2020,
  );
  if (
    typeof input.gapColumnHeader === "string" &&
    input.gapColumnHeader.trim() &&
    (!input.colGapHeader || !String(input.colGapHeader).trim())
  ) {
    next.colGapHeader = input.gapColumnHeader;
  }
  /** Migrate pre-split logo sizes into both desktop and mobile when new keys absent. */
  if (
    typeof input.finalFourLogoSizePx === "string" &&
    input.finalFourLogoSizePx.trim()
  ) {
    if (!input.finalFourLogoSizeDesktopPx) {
      next.finalFourLogoSizeDesktopPx = input.finalFourLogoSizePx;
    }
    if (!input.finalFourLogoSizeMobilePx) {
      next.finalFourLogoSizeMobilePx = input.finalFourLogoSizePx;
    }
  }
  if (typeof input.champLogoSizePx === "string" && input.champLogoSizePx.trim()) {
    if (!input.champLogoSizeDesktopPx) {
      next.champLogoSizeDesktopPx = input.champLogoSizePx;
    }
    if (!input.champLogoSizeMobilePx) {
      next.champLogoSizeMobilePx = input.champLogoSizePx;
    }
  }
  const year = next.standingsYear.trim();
  if (!/^\d{4}$/.test(year)) {
    next.standingsYear = defaults.standingsYear;
  }
  const flag = next.showPaidIndicator.trim().toLowerCase();
  if (flag === "false" || flag === "no" || flag === "0" || flag === "off") {
    next.showPaidIndicator = "false";
  } else {
    next.showPaidIndicator = "true";
  }
  if (!next.paidGlyph.trim()) {
    next.paidGlyph = defaults.paidGlyph;
  }
  if (!next.paidAriaLabel.trim()) {
    next.paidAriaLabel = defaults.paidAriaLabel;
  }
  const sizing = resolveStandingsLogoSizing(next);
  next.finalFourLogoSizeDesktopPx = String(sizing.finalFourDesktopPx);
  next.champLogoSizeDesktopPx = String(sizing.champDesktopPx);
  next.finalFourLogoSizeMobilePx = String(sizing.finalFourMobilePx);
  next.champLogoSizeMobilePx = String(sizing.champMobilePx);
  next.finalFourLogoSizeCardPx = String(sizing.finalFourCardPx);
  next.champLogoSizeCardPx = String(sizing.champCardPx);
  next.logoFillPercent = String(sizing.logoFillPercent);
  next.finalistBorderWidthPx = String(sizing.finalistBorderPx);
  next.shadeCorrect = normalizeCssColor(
    next.shadeCorrect,
    defaults.shadeCorrect,
  );
  next.shadeIncorrect = normalizeCssColor(
    next.shadeIncorrect,
    defaults.shadeIncorrect,
  );
  next.shadePending = normalizeCssColor(
    next.shadePending,
    defaults.shadePending,
  );
  next.borderCorrect = normalizeCssColor(
    next.borderCorrect,
    defaults.borderCorrect,
  );
  next.borderIncorrect = normalizeCssColor(
    next.borderIncorrect,
    defaults.borderIncorrect,
  );
  next.borderPendingFinalist = normalizeCssColor(
    next.borderPendingFinalist,
    defaults.borderPendingFinalist,
  );
  /** Blank a11y phrases fall back to built-in defaults. */
  const a11yKeys: VintageStandingsStringKey[] = [
    "a11yEmptySelection",
    "a11yNoChampionPick",
    "a11yCorrectRegional",
    "a11yIncorrectRegional",
    "a11yCorrectChampion",
    "a11yIncorrectChampion",
    "a11yCorrectFinalist",
    "a11yIncorrectFinalist",
    "a11yPending",
    "a11yFinalistFrame",
  ];
  for (const key of a11yKeys) {
    if (!String(next[key]).trim()) {
      next[key] = defaults[key];
    }
  }
  return next;
}

/**
 * Map Standings CMS fields → shared pick-result hover / aria phrases
 * (used by Standings and My Picks).
 *
 * @param copy - Normalized Standings CMS document
 */
export function standingsPickResultA11yPhrases(
  copy: VintageStandingsContent,
): PickResultA11yPhrases {
  const pick = (value: string, fallback: string) => {
    const trimmed = value.trim();
    return trimmed || fallback;
  };
  const d = DEFAULT_PICK_RESULT_A11Y_PHRASES;
  return {
    emptySelection: pick(copy.a11yEmptySelection, d.emptySelection),
    noChampionPick: pick(copy.a11yNoChampionPick, d.noChampionPick),
    correctRegional: pick(copy.a11yCorrectRegional, d.correctRegional),
    incorrectRegional: pick(copy.a11yIncorrectRegional, d.incorrectRegional),
    correctChampion: pick(copy.a11yCorrectChampion, d.correctChampion),
    incorrectChampion: pick(copy.a11yIncorrectChampion, d.incorrectChampion),
    correctFinalist: pick(copy.a11yCorrectFinalist, d.correctFinalist),
    incorrectFinalist: pick(copy.a11yIncorrectFinalist, d.incorrectFinalist),
    pending: pick(copy.a11yPending, d.pending),
    finalistFrame: pick(copy.a11yFinalistFrame, d.finalistFrame),
  };
}

/**
 * CSS custom properties for FF / Champ result chrome (Standings + Picks).
 */
export function standingsResultChromeStyle(
  copy: VintageStandingsContent,
): Record<string, string> {
  const sizing = resolveStandingsLogoSizing(copy);
  return {
    "--vs-ff-size-desktop": `${sizing.finalFourDesktopPx}px`,
    "--vs-champ-size-desktop": `${sizing.champDesktopPx}px`,
    "--vs-ff-size-mobile": `${sizing.finalFourMobilePx}px`,
    "--vs-champ-size-mobile": `${sizing.champMobilePx}px`,
    "--vs-ff-size-card": `${sizing.finalFourCardPx}px`,
    "--vs-champ-size-card": `${sizing.champCardPx}px`,
    "--vs-logo-fill": `${sizing.logoFillPercent}%`,
    "--vs-finalist-border": `${sizing.finalistBorderPx}px`,
    "--vs-shade-correct": copy.shadeCorrect,
    "--vs-shade-incorrect": copy.shadeIncorrect,
    "--vs-shade-pending": copy.shadePending,
    "--vs-border-correct": copy.borderCorrect,
    "--vs-border-incorrect": copy.borderIncorrect,
    "--vs-border-pending": copy.borderPendingFinalist,
  };
}

/**
 * Validate Standings CMS copy before save/publish.
 */
export function validateVintageStandingsContent(
  value: unknown,
): asserts value is VintageStandingsContent {
  const doc = normalizeVintageStandingsContent(value);
  if (!doc.heading.trim()) {
    throw new Error("Standings heading cannot be blank.");
  }
  if (!/^\d{4}$/.test(doc.standingsYear.trim())) {
    throw new Error("Standings Year must be a four-digit year.");
  }
  if (!doc.filterAllLabel.trim() || !doc.filterMineLabel.trim()) {
    throw new Error("Standings filter labels cannot be blank.");
  }
  const requiredHeaders: (keyof VintageStandingsContent)[] = [
    "colRankHeader",
    "colEntryHeader",
    "colPaidHeader",
    "colPointsHeader",
    "colGapHeader",
    "colTbHeader",
    "colFinalFourHeader",
    "colChampHeader",
    "colRankHeaderMobile",
    "colEntryHeaderMobile",
    "colPaidHeaderMobile",
    "colFinalFourHeaderMobile",
    "colChampHeaderMobile",
  ];
  for (const key of requiredHeaders) {
    if (!String(doc[key]).trim()) {
      throw new Error("Standings column headers cannot be blank.");
    }
  }
  validateVintageStandingsPaper2020(doc.paper2020);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in doc)) delete record[key];
    }
    Object.assign(record, doc);
  }
}

/**
 * Replace `{year}`, `{shown}`, `{total}` in standings CMS templates.
 */
export function formatVintageStandingsLabel(
  template: string,
  vars: { year?: number | string; shown?: number; total?: number },
): string {
  let out = template;
  if (vars.year != null) {
    out = out.replace(/\{year\}/g, String(vars.year));
  }
  if (vars.shown != null) {
    out = out.replace(/\{shown\}/g, String(vars.shown));
  }
  if (vars.total != null) {
    out = out.replace(/\{total\}/g, String(vars.total));
  }
  return out;
}
