/**
 * CMS copy for the vintage Live Standings page (not ranking data —
 * that stays in live_standings_snapshots).
 */

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
  /** Desktop Final Four logo tile size in px (square), e.g. "22". */
  finalFourLogoSizeDesktopPx: string;
  /** Desktop Champion logo tile size in px (square), e.g. "28". */
  champLogoSizeDesktopPx: string;
  /** Mobile Final Four logo tile size in px (square), e.g. "22". */
  finalFourLogoSizeMobilePx: string;
  /** Mobile Champion logo tile size in px (square), e.g. "28". */
  champLogoSizeMobilePx: string;
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
}

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
  finalFourLogoSizeDesktopPx: "32",
  champLogoSizeDesktopPx: "42",
  finalFourLogoSizeMobilePx: "32",
  champLogoSizeMobilePx: "42",
  finalistBorderWidthPx: "2",
  shadeCorrect: "#dcfce7",
  shadeIncorrect: "#fee2e2",
  shadePending: "#ffffff",
  borderCorrect: "#16a34a",
  borderIncorrect: "#dc2626",
  borderPendingFinalist: "#000000",
  gapColumnAriaLabel: "Points behind the leader",
  yearSelectAriaLabel: "Viewing year {year}. Change standings year",
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
    if (typeof input[key] === "string") next[key] = input[key] as string;
  }
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
  next.finalFourLogoSizeDesktopPx = String(
    parseStandingsPx(
      next.finalFourLogoSizeDesktopPx,
      22,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
  );
  next.champLogoSizeDesktopPx = String(
    parseStandingsPx(
      next.champLogoSizeDesktopPx,
      28,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
  );
  next.finalFourLogoSizeMobilePx = String(
    parseStandingsPx(
      next.finalFourLogoSizeMobilePx,
      22,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
  );
  next.champLogoSizeMobilePx = String(
    parseStandingsPx(
      next.champLogoSizeMobilePx,
      28,
      LOGO_SIZE_MIN,
      LOGO_SIZE_MAX,
    ),
  );
  next.finalistBorderWidthPx = String(
    parseStandingsPx(
      next.finalistBorderWidthPx,
      2,
      BORDER_WIDTH_MIN,
      BORDER_WIDTH_MAX,
    ),
  );
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
  return next;
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
