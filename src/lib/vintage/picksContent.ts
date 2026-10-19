/**
 * CMS copy for the vintage My Picks landing page.
 *
 * Timer labels and the prior-year switch control are live now.
 * `poolFlavors.current` / `poolFlavors.historic` are reserved so historic
 * vs current pool messaging can diverge later without a schema rewrite —
 * do not invent extra flavors until product asks for them.
 */
export interface VintagePicksPoolFlavor {
  /**
   * Reserved note for this flavor (empty until we wire pool-message CMS).
   * Keep the key so published JSON already has the bucket.
   */
  note: string;
}

export interface VintagePicksContent {
  /** Shown before brackets are published. Supports `{year}`. */
  countdownToBracketLabel: string;
  /** Shown once brackets are available (countdown to tip-off). Supports `{year}`. */
  countdownToTipoffLabel: string;
  /**
   * Replaces the timer when viewing a prior year.
   * Supports `{year}` (viewing) and `{activeYear}` (switch target).
   */
  viewingPriorYearLabel: string;
  /** Flavor buckets for future current vs historic pool messages. */
  poolFlavors: {
    current: VintagePicksPoolFlavor;
    historic: VintagePicksPoolFlavor;
  };
}

const EMPTY_FLAVOR = (): VintagePicksPoolFlavor => ({ note: "" });

export const DEFAULT_VINTAGE_PICKS_CONTENT: VintagePicksContent = {
  countdownToBracketLabel: "Countdown to {year} bracket",
  countdownToTipoffLabel: "Countdown to {year} tipoff",
  viewingPriorYearLabel:
    "Viewing {year}. Click here to switch back to {activeYear}",
  poolFlavors: {
    current: EMPTY_FLAVOR(),
    historic: EMPTY_FLAVOR(),
  },
};

/**
 * Normalize one pool-flavor bucket from stored JSON.
 */
function normalizePoolFlavor(value: unknown): VintagePicksPoolFlavor {
  const defaults = EMPTY_FLAVOR();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const input = value as Partial<VintagePicksPoolFlavor>;
  return {
    note: typeof input.note === "string" ? input.note : defaults.note,
  };
}

/**
 * Fill missing My Picks CMS fields from defaults.
 */
export function normalizeVintagePicksContent(
  value: unknown,
): VintagePicksContent {
  const defaults = structuredClone(DEFAULT_VINTAGE_PICKS_CONTENT);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const input = value as Partial<VintagePicksContent> & {
    poolFlavors?: Partial<VintagePicksContent["poolFlavors"]>;
  };
  return {
    countdownToBracketLabel:
      typeof input.countdownToBracketLabel === "string"
        ? input.countdownToBracketLabel
        : defaults.countdownToBracketLabel,
    countdownToTipoffLabel:
      typeof input.countdownToTipoffLabel === "string"
        ? input.countdownToTipoffLabel
        : defaults.countdownToTipoffLabel,
    viewingPriorYearLabel:
      typeof input.viewingPriorYearLabel === "string"
        ? input.viewingPriorYearLabel
        : defaults.viewingPriorYearLabel,
    poolFlavors: {
      current: normalizePoolFlavor(input.poolFlavors?.current),
      historic: normalizePoolFlavor(input.poolFlavors?.historic),
    },
  };
}

/**
 * Validate My Picks CMS copy before save/publish.
 */
export function validateVintagePicksContent(
  value: unknown,
): asserts value is VintagePicksContent {
  const doc = normalizeVintagePicksContent(value);
  if (!doc.countdownToBracketLabel.trim()) {
    throw new Error("Countdown-to-bracket label cannot be blank.");
  }
  if (!doc.countdownToTipoffLabel.trim()) {
    throw new Error("Countdown-to-tipoff label cannot be blank.");
  }
  if (!doc.viewingPriorYearLabel.trim()) {
    throw new Error("Prior-year viewing label cannot be blank.");
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
 * Replace `{year}` / `{activeYear}` tokens in adminable My Picks copy.
 */
export function formatVintagePicksLabel(
  template: string,
  vars: { year: number | string; activeYear?: number | string },
): string {
  return template
    .replace(/\{year\}/g, String(vars.year))
    .replace(/\{activeYear\}/g, String(vars.activeYear ?? vars.year));
}
