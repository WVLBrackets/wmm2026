import { isAllowedToolbarIcon } from "./toolbarIcons";

/** One TOC / guide nav item. */
export interface VintageInfoTocItem {
  id: string;
  label: string;
  /** Fragment without # (e.g. entry-payment). */
  anchor: string;
}

/** One numbered entry step. */
export interface VintageInfoStep {
  title: string;
  description: string;
}

/** One scoring table row (display copy only — not the scoring engine). */
export interface VintageInfoScoringRow {
  round: string;
  points: string;
}

/** Dollars per entry used for prize-pool math. */
export const INFO_PRIZE_ENTRY_FEE = 5;

/** One prize place column (amount is derived from pool × percent). */
export interface VintageInfoPrizePlace {
  place: string;
  /** Share of the pool, 0–100 (e.g. 60 for first place). */
  percent: number;
}

/**
 * CMS document for the Tournament Handbook (/info) vintage experience.
 */
export interface VintageInfoContent {
  intro: {
    heading: string;
    supporting: string;
  };
  quickFacts: {
    /** Column title above the fee icon (e.g. Entry Fee). */
    feeTitle: string;
    /** Fee caption under the icon (e.g. $5). */
    feeValue: string;
    /** Lucide name or custom: URL for the fee column icon. */
    feeIcon: string;
    /** Column title above the deadline icon. */
    deadlineTitle: string;
    /** Lucide name or custom: URL for the deadline column icon. */
    deadlineIcon: string;
    /** Column title above the CTA icon. */
    ctaTitle: string;
    /** Lucide name or custom: URL for the CTA column icon. */
    ctaIcon: string;
    /** CTA caption / button label. */
    ctaLabel: string;
  };
  toc: {
    heading: string;
    items: VintageInfoTocItem[];
  };
  entry: {
    heading: string;
    steps: [VintageInfoStep, VintageInfoStep, VintageInfoStep];
    multiEntryNote: string;
    electronicHeading: string;
    electronicBody: string;
    cashHeading: string;
    cashBody: string;
  };
  scoring: {
    heading: string;
    tableCaption: string;
    rows: VintageInfoScoringRow[];
    underdogHeading: string;
    underdogBody: string;
    firstFourNote: string;
    examplesHeading: string;
    examples: string[];
  };
  prizes: {
    heading: string;
    /** "projected" | "finalized" — selects which pool label/explanation to show. */
    status: "projected" | "finalized";
    /** Entry count used for pool math (pool = $5 × entries). */
    entryCount: number;
    projectedPoolLabel: string;
    finalizedPoolLabel: string;
    projectedPoolExplanation: string;
    finalizedPoolExplanation: string;
    /** Shown under the pool when status is projected. */
    footnote: string;
    places: [VintageInfoPrizePlace, VintageInfoPrizePlace, VintageInfoPrizePlace];
  };
  tracker: {
    heading: string;
    /** Body copy; use `||` for a hard line break between paragraphs. */
    notes: string;
  };
  questions: {
    heading: string;
    body: string;
    actionLabel: string;
    contactEmail: string;
  };
}

/**
 * Prize pool dollars from entry count ($5 per entry).
 */
export function infoPrizePoolTotal(entryCount: number): number {
  const n = Number.isFinite(entryCount) ? Math.max(0, Math.floor(entryCount)) : 0;
  return n * INFO_PRIZE_ENTRY_FEE;
}

/**
 * Dollar amount for one place from pool total and percent share.
 */
export function infoPrizePlaceAmount(poolTotal: number, percent: number): number {
  const pct = Number.isFinite(percent) ? percent : 0;
  return Math.round((poolTotal * pct) / 100);
}

/**
 * Format a whole-dollar prize amount for display (e.g. $2,750).
 */
export function formatInfoPrizeDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Replace `<entries>` in prize copy with the formatted entry count.
 */
export function resolveInfoEntriesToken(
  text: string,
  entryCount: number,
): string {
  const formatted = new Intl.NumberFormat("en-US").format(
    Number.isFinite(entryCount) ? Math.max(0, Math.floor(entryCount)) : 0,
  );
  return text.split("<entries>").join(formatted);
}

/**
 * Resolve status-aware pool copy and calculated place amounts for the handbook page.
 * When status is projected, dollar amounts include a trailing asterisk.
 */
export function resolveInfoPrizeDisplay(
  prizes: VintageInfoContent["prizes"],
): {
  poolLabel: string;
  poolExplanation: string;
  poolTotalLabel: string;
  places: Array<{ place: string; percentLabel: string; amountLabel: string }>;
  showFootnote: boolean;
} {
  const pool = infoPrizePoolTotal(prizes.entryCount);
  const finalized = prizes.status === "finalized";
  const mark = finalized ? "" : "*";
  const rawExplanation = finalized
    ? prizes.finalizedPoolExplanation
    : prizes.projectedPoolExplanation;
  return {
    poolLabel: finalized
      ? prizes.finalizedPoolLabel
      : prizes.projectedPoolLabel,
    poolExplanation: resolveInfoEntriesToken(rawExplanation, prizes.entryCount),
    poolTotalLabel: `${formatInfoPrizeDollars(pool)}${mark}`,
    places: prizes.places.map((place) => ({
      place: place.place,
      percentLabel: `${place.percent}%`,
      amountLabel: `${formatInfoPrizeDollars(
        infoPrizePlaceAmount(pool, place.percent),
      )}${mark}`,
    })),
    showFootnote: !finalized && Boolean(prizes.footnote.trim()),
  };
}

/**
 * Split tracker notes on `||` into display paragraphs.
 */
export function parseInfoNotesLines(raw: string): string[] {
  return raw
    .split("||")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parse a CMS percent field ("60", "60%", 60) into 0–100.
 */
function parsePrizePercent(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, value));
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    }
  }
  return fallback;
}

/**
 * Parse entry count from a number or legacy pool-total string like "$2,750".
 */
function parseEntryCount(value: unknown, legacyPoolTotal?: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  if (typeof legacyPoolTotal === "string") {
    const dollars = Number(legacyPoolTotal.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(dollars) && dollars > 0) {
      return Math.max(0, Math.round(dollars / INFO_PRIZE_ENTRY_FEE));
    }
  }
  return DEFAULT_VINTAGE_INFO_CONTENT.prizes.entryCount;
}

/**
 * Compact tipoff deadline for the quick-facts strip (e.g. 3/19 12:00 pm EST).
 * Uses America/New_York. Empty when no valid ISO timestamp.
 */
export function formatInfoDeadline(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed || !Number.isFinite(Date.parse(trimmed))) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(new Date(trimmed));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const dayPeriod = get("dayPeriod").toLowerCase();
  const tz = get("timeZoneName") || "ET";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")} ${dayPeriod} ${tz}`;
}

/** Soft-migrate pre-break TOC labels to the `||` two-line form. */
const TOC_LABEL_BREAK_MIGRATIONS: Record<string, string> = {
  "Entry & Payment": "Entry &||Payment",
  "Tracker & Results": "Tracker &||Results",
};

/**
 * Split a TOC label on `||` into at most two display lines.
 */
export function parseInfoTocLabelLines(label: string): string[] {
  const parts = label
    .split("||")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return parts.length ? [parts[0]] : [];
  return [parts[0], parts.slice(1).join(" ")];
}

/**
 * Single-line TOC label (sidebar): `||` becomes a space.
 */
export function formatInfoTocLabelPlain(label: string): string {
  return parseInfoTocLabelLines(label).join(" ");
}

/**
 * Normalize a TOC item list to guide anchors (Questions stays on-page, not in TOC).
 */
function normalizeTocItems(value: unknown): VintageInfoTocItem[] {
  const defaults = DEFAULT_VINTAGE_INFO_CONTENT.toc.items;
  if (!Array.isArray(value) || !value.length) return structuredClone(defaults);
  const mapped = value.slice(0, 8).map((raw, index) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const fallback = defaults[index] ?? defaults[0];
    const rawLabel =
      typeof item.label === "string" ? item.label : fallback.label;
    const label = TOC_LABEL_BREAK_MIGRATIONS[rawLabel.trim()] ?? rawLabel;
    return {
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : fallback.id,
      label,
      anchor:
        typeof item.anchor === "string" && item.anchor.trim()
          ? item.anchor.replace(/^#/, "")
          : fallback.anchor,
    };
  });
  const withoutQuestions = mapped.filter(
    (item) => item.anchor !== "questions" && item.id !== "toc-questions",
  );
  return withoutQuestions.length
    ? withoutQuestions
    : structuredClone(defaults);
}

/**
 * Normalize three entry steps.
 */
function normalizeSteps(
  value: unknown,
): [VintageInfoStep, VintageInfoStep, VintageInfoStep] {
  const defaults = DEFAULT_VINTAGE_INFO_CONTENT.entry.steps;
  const list = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => {
    const raw = list[index];
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      title:
        typeof item.title === "string" ? item.title : defaults[index].title,
      description:
        typeof item.description === "string"
          ? item.description
          : defaults[index].description,
    };
  }) as [VintageInfoStep, VintageInfoStep, VintageInfoStep];
}

/**
 * Normalize scoring rows (1–12).
 */
function normalizeScoringRows(value: unknown): VintageInfoScoringRow[] {
  const defaults = DEFAULT_VINTAGE_INFO_CONTENT.scoring.rows;
  if (!Array.isArray(value) || !value.length) return structuredClone(defaults);
  return value.slice(0, 12).map((raw, index) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const fallback = defaults[index] ?? { round: "", points: "" };
    return {
      round: typeof item.round === "string" ? item.round : fallback.round,
      points: typeof item.points === "string" ? item.points : fallback.points,
    };
  });
}

/**
 * Normalize three prize places (legacy percentLabel → percent).
 */
function normalizePlaces(
  value: unknown,
): [VintageInfoPrizePlace, VintageInfoPrizePlace, VintageInfoPrizePlace] {
  const defaults = DEFAULT_VINTAGE_INFO_CONTENT.prizes.places;
  const list = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => {
    const raw = list[index];
    const item =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};
    const percentSource =
      item.percent !== undefined ? item.percent : item.percentLabel;
    return {
      place:
        typeof item.place === "string" ? item.place : defaults[index].place,
      percent: parsePrizePercent(percentSource, defaults[index].percent),
    };
  }) as [VintageInfoPrizePlace, VintageInfoPrizePlace, VintageInfoPrizePlace];
}

/**
 * Normalize prizes CMS, migrating legacy single label/total/explanation fields.
 */
function normalizePrizes(
  prizesIn: Partial<VintageInfoContent["prizes"]> & Record<string, unknown>,
  status: "projected" | "finalized",
  defaults: VintageInfoContent["prizes"],
): VintageInfoContent["prizes"] {
  const legacyLabel =
    typeof prizesIn.poolLabel === "string" ? prizesIn.poolLabel : "";
  const legacyExplanation =
    typeof prizesIn.poolExplanation === "string"
      ? prizesIn.poolExplanation
      : "";

  const projectedPoolLabel =
    typeof prizesIn.projectedPoolLabel === "string" &&
    prizesIn.projectedPoolLabel.trim()
      ? prizesIn.projectedPoolLabel
      : legacyLabel && status !== "finalized"
        ? legacyLabel
        : defaults.projectedPoolLabel;
  const finalizedPoolLabel =
    typeof prizesIn.finalizedPoolLabel === "string" &&
    prizesIn.finalizedPoolLabel.trim()
      ? prizesIn.finalizedPoolLabel
      : legacyLabel && status === "finalized"
        ? legacyLabel
        : defaults.finalizedPoolLabel;
  const projectedPoolExplanation =
    typeof prizesIn.projectedPoolExplanation === "string" &&
    prizesIn.projectedPoolExplanation.trim()
      ? prizesIn.projectedPoolExplanation
      : legacyExplanation && status !== "finalized"
        ? legacyExplanation
        : defaults.projectedPoolExplanation;
  const finalizedPoolExplanation =
    typeof prizesIn.finalizedPoolExplanation === "string" &&
    prizesIn.finalizedPoolExplanation.trim()
      ? prizesIn.finalizedPoolExplanation
      : legacyExplanation && status === "finalized"
        ? legacyExplanation
        : defaults.finalizedPoolExplanation;

  return {
    heading:
      typeof prizesIn.heading === "string" ? prizesIn.heading : defaults.heading,
    status,
    entryCount: parseEntryCount(prizesIn.entryCount, prizesIn.poolTotal),
    projectedPoolLabel,
    finalizedPoolLabel,
    projectedPoolExplanation,
    finalizedPoolExplanation,
    footnote:
      typeof prizesIn.footnote === "string"
        ? prizesIn.footnote
        : defaults.footnote,
    places: normalizePlaces(prizesIn.places),
  };
}

/**
 * Fill missing handbook fields for older CMS documents.
 */
export function normalizeVintageInfoContent(value: unknown): VintageInfoContent {
  const defaults = structuredClone(DEFAULT_VINTAGE_INFO_CONTENT);
  if (!value || typeof value !== "object") return defaults;
  const input = value as Partial<VintageInfoContent> & Record<string, unknown>;
  const introIn =
    input.intro && typeof input.intro === "object"
      ? (input.intro as Partial<VintageInfoContent["intro"]>)
      : {};
  const quickIn =
    input.quickFacts && typeof input.quickFacts === "object"
      ? (input.quickFacts as Partial<VintageInfoContent["quickFacts"]>)
      : {};
  const tocIn =
    input.toc && typeof input.toc === "object"
      ? (input.toc as Partial<VintageInfoContent["toc"]>)
      : {};
  const entryIn =
    input.entry && typeof input.entry === "object"
      ? (input.entry as Partial<VintageInfoContent["entry"]>)
      : {};
  const scoringIn =
    input.scoring && typeof input.scoring === "object"
      ? (input.scoring as Partial<VintageInfoContent["scoring"]>)
      : {};
  const prizesIn =
    input.prizes && typeof input.prizes === "object"
      ? (input.prizes as Partial<VintageInfoContent["prizes"]>)
      : {};
  const trackerIn =
    input.tracker && typeof input.tracker === "object"
      ? (input.tracker as Partial<VintageInfoContent["tracker"]>)
      : {};
  const questionsIn =
    input.questions && typeof input.questions === "object"
      ? (input.questions as Partial<VintageInfoContent["questions"]>)
      : {};

  const status =
    prizesIn.status === "finalized" || prizesIn.status === "projected"
      ? prizesIn.status
      : defaults.prizes.status;

  const legacyQuick = quickIn as Partial<VintageInfoContent["quickFacts"]> & {
    feeLabel?: string;
    entryLimitLabel?: string;
    deadlinePrefix?: string;
  };
  const feeTitle =
    typeof legacyQuick.feeTitle === "string" && legacyQuick.feeTitle.trim()
      ? legacyQuick.feeTitle
      : typeof legacyQuick.feeLabel === "string" && legacyQuick.feeLabel.trim()
        ? legacyQuick.feeLabel
        : defaults.quickFacts.feeTitle;
  const deadlineTitle =
    typeof legacyQuick.deadlineTitle === "string" &&
    legacyQuick.deadlineTitle.trim()
      ? legacyQuick.deadlineTitle
      : typeof legacyQuick.deadlinePrefix === "string" &&
          legacyQuick.deadlinePrefix.trim()
        ? legacyQuick.deadlinePrefix.replace(/:\s*$/, "")
        : defaults.quickFacts.deadlineTitle;

  return {
    intro: {
      heading:
        typeof introIn.heading === "string"
          ? introIn.heading
          : defaults.intro.heading,
      supporting:
        typeof introIn.supporting === "string"
          ? introIn.supporting
          : defaults.intro.supporting,
    },
    quickFacts: {
      feeTitle,
      feeValue:
        typeof legacyQuick.feeValue === "string" && legacyQuick.feeValue.trim()
          ? legacyQuick.feeValue
          : defaults.quickFacts.feeValue,
      feeIcon:
        typeof legacyQuick.feeIcon === "string" && legacyQuick.feeIcon.trim()
          ? legacyQuick.feeIcon.trim()
          : defaults.quickFacts.feeIcon,
      deadlineTitle,
      deadlineIcon:
        typeof legacyQuick.deadlineIcon === "string" &&
        legacyQuick.deadlineIcon.trim()
          ? legacyQuick.deadlineIcon.trim()
          : defaults.quickFacts.deadlineIcon,
      ctaTitle:
        typeof legacyQuick.ctaTitle === "string" && legacyQuick.ctaTitle.trim()
          ? legacyQuick.ctaTitle
          : defaults.quickFacts.ctaTitle,
      ctaIcon:
        typeof legacyQuick.ctaIcon === "string" && legacyQuick.ctaIcon.trim()
          ? legacyQuick.ctaIcon.trim()
          : defaults.quickFacts.ctaIcon,
      ctaLabel:
        typeof legacyQuick.ctaLabel === "string" && legacyQuick.ctaLabel.trim()
          ? legacyQuick.ctaLabel
          : defaults.quickFacts.ctaLabel,
    },
    toc: {
      heading:
        typeof tocIn.heading === "string" ? tocIn.heading : defaults.toc.heading,
      items: normalizeTocItems(tocIn.items),
    },
    entry: {
      ...defaults.entry,
      ...entryIn,
      steps: normalizeSteps(entryIn.steps),
    },
    scoring: {
      ...defaults.scoring,
      ...scoringIn,
      rows: normalizeScoringRows(scoringIn.rows),
      examples: Array.isArray(scoringIn.examples)
        ? scoringIn.examples
            .filter((item): item is string => typeof item === "string")
            .slice(0, 8)
        : defaults.scoring.examples,
    },
    prizes: normalizePrizes(prizesIn, status, defaults.prizes),
    tracker: normalizeTracker(
      trackerIn as Partial<VintageInfoContent["tracker"]> &
        Record<string, unknown>,
      defaults.tracker,
    ),
    questions: { ...defaults.questions, ...questionsIn },
  };
}

/**
 * Normalize tracker CMS to heading + notes (`||` line breaks).
 * Migrates legacy body / optionalNote / releaseNote into notes.
 */
function normalizeTracker(
  trackerIn: Partial<VintageInfoContent["tracker"]> & Record<string, unknown>,
  defaults: VintageInfoContent["tracker"],
): VintageInfoContent["tracker"] {
  const legacyParts = [
    trackerIn.body,
    trackerIn.optionalNote,
    trackerIn.releaseNote,
  ]
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim());
  const notes =
    typeof trackerIn.notes === "string" && trackerIn.notes.trim()
      ? trackerIn.notes
      : legacyParts.length
        ? legacyParts.join("||")
        : defaults.notes;
  return {
    heading:
      typeof trackerIn.heading === "string"
        ? trackerIn.heading
        : defaults.heading,
    notes,
  };
}

export const DEFAULT_VINTAGE_INFO_CONTENT: VintageInfoContent = {
  intro: {
    heading: "The Tournament Handbook",
    supporting:
      "How to enter. How scoring works. What you’re playing for.",
  },
  quickFacts: {
    feeTitle: "Entry fee",
    feeValue: "$5 each",
    feeIcon:
      "custom:https://br-odd-rice-ad9n8mtb.storage.c-2.us-east-1.aws.neon.tech/vintage-homepage-media/vintage/b1f7c79f-8317-4be2-a2b7-98236d4a99ce.svg",
    deadlineTitle: "DEADLINE",
    deadlineIcon: "Calendar",
    ctaTitle: "Play",
    ctaIcon: "ArrowRight",
    ctaLabel: "MAKE YOUR PICKS",
  },
  toc: {
    heading: "IN THIS GUIDE",
    items: [
      { id: "toc-entry", label: "Entry &||Payment", anchor: "entry-payment" },
      { id: "toc-scoring", label: "Scoring", anchor: "scoring" },
      { id: "toc-prizes", label: "Prizes", anchor: "prizes" },
      { id: "toc-tracker", label: "Tracker &||Results", anchor: "tracker" },
    ],
  },
  entry: {
    heading: "01 ENTRY & PAYMENT",
    steps: [
      {
        title: "Make Your Picks",
        description:
          "Complete your bracket online on My Picks, or email your picks sheet to NCAATourney@gmail.com.",
      },
      {
        title: "Submit Before the Deadline",
        description:
          "Entries must be received by tipoff on the first day of the First Round (see the deadline in the strip above).",
      },
      {
        title: "Pay $5 Per Entry",
        description:
          "Include the list of entry names when paying for several brackets.",
      },
    ],
    multiEntryNote: "",
    electronicHeading: "Electronic Payments",
    electronicBody:
      "Electronic payments are preferred. Just be sure you are following the Terms & Conditions of the platform you are using.",
    cashHeading: "Cash",
    cashBody:
      "Cash is welcome if you plan to see the commissioner or if you live nearby.",
  },
  scoring: {
    heading: "02 HOW THE POINTS ADD UP",
    tableCaption: "Round scoring",
    rows: [
      { round: "First Round", points: "1" },
      { round: "Second Round", points: "2" },
      { round: "Sweet Sixteen", points: "4" },
      { round: "Elite Eight", points: "8" },
      { round: "Final Four", points: "12" },
      { round: "Championship", points: "16" },
    ],
    underdogHeading: "The Underdog Bonus",
    underdogBody:
      "You receive 2 additional points each time the team you select defeats a higher-seeded team. This bonus applies in every round.",
    firstFourNote:
      'The "First Four" play-in games are ignored in our scoring.',
    examplesHeading: "Scoring Examples",
    examples: [
      "If you correctly select a 9 seed to beat an 8 seed in the first round, you get 3 points (1 for the win + 2 underdog bonus).",
      "If you pick a 2 seed to win the finals and they beat a 1 seed, you get 18 points (16 + 2 underdog). If they beat a 3 seed, you get 16 points (no underdog bonus).",
    ],
  },
  prizes: {
    heading: "03 WHAT YOU’RE PLAYING FOR",
    status: "projected",
    entryCount: 572,
    projectedPoolLabel: "PROJECTED PRIZE POOL",
    finalizedPoolLabel: "PRIZE POOL",
    projectedPoolExplanation:
      "Projected based on last year's entry count (<entries>). Final amounts will be set based on final entry count.",
    finalizedPoolExplanation:
      "Prize amounts are based on <entries> entries this year.",
    footnote:
      "*Prize amounts will be finalized based on the actual number of entries.",
    places: [
      { place: "1st Place", percent: 60 },
      { place: "2nd Place", percent: 30 },
      { place: "3rd Place", percent: 10 },
    ],
  },
  tracker: {
    heading: "04 THE TRACKER & RESULTS",
    notes:
      "The Tracker spreadsheet gives detailed visibility into everyone’s picks as the tournament unfolds.||Using the spreadsheet is optional — website standings are updated on the site.||Excel downloads will be available on the homepage when the files are available.",
  },
  questions: {
    heading: "QUESTIONS?",
    body: "Email the commissioner with entry, payment, or rules questions.",
    actionLabel: "Send Email",
    contactEmail: "NCAATourney@gmail.com",
  },
};

/**
 * Strictly validate the handbook document before draft or publication.
 */
export function validateVintageInfoContent(
  value: unknown,
): asserts value is VintageInfoContent {
  const normalized = normalizeVintageInfoContent(value);
  function shape(actual: unknown, sample: unknown, path: string): void {
    if (Array.isArray(sample)) {
      if (!Array.isArray(actual) || actual.length > 30)
        throw new Error(`${path}: invalid list.`);
      if (path === "entry.steps" && actual.length !== 3)
        throw new Error("Exactly three entry steps are required.");
      if (path === "prizes.places" && actual.length !== 3)
        throw new Error("Exactly three prize places are required.");
      if (actual.length === 0) return;
      actual.forEach((item, index) =>
        shape(item, sample[0] ?? item, `${path}.${index}`),
      );
      return;
    }
    if (sample && typeof sample === "object") {
      if (!actual || typeof actual !== "object" || Array.isArray(actual))
        throw new Error(`${path}: invalid object.`);
      const record = actual as Record<string, unknown>;
      for (const [key, val] of Object.entries(sample)) {
        if (!(key in record)) throw new Error(`${path}.${key} is required.`);
        shape(record[key], val, path ? `${path}.${key}` : key);
      }
      if (Object.keys(record).some((key) => !(key in sample)))
        throw new Error(`${path}: unknown field.`);
      return;
    }
    if (typeof actual !== typeof sample)
      throw new Error(`${path}: invalid value.`);
    if (typeof actual === "string" && actual.length > 6000)
      throw new Error(`${path}: text is too long.`);
  }
  shape(normalized, DEFAULT_VINTAGE_INFO_CONTENT, "");
  const doc = normalized;
  if (!doc.intro.heading.trim())
    throw new Error("Handbook heading cannot be blank.");
  if (!doc.quickFacts.ctaLabel.trim())
    throw new Error("Make Your Picks label cannot be blank.");
  for (const key of ["feeIcon", "deadlineIcon", "ctaIcon"] as const) {
    const icon = doc.quickFacts[key];
    if (!icon || !isAllowedToolbarIcon(icon))
      throw new Error(`Quick facts ${key} must be a Lucide icon or custom SVG.`);
  }
  if (
    doc.questions.contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.questions.contactEmail)
  )
    throw new Error("Enter a valid commissioner contact email.");
  if (doc.prizes.status !== "projected" && doc.prizes.status !== "finalized")
    throw new Error("Prize status must be projected or finalized.");
  if (
    !Number.isFinite(doc.prizes.entryCount) ||
    doc.prizes.entryCount < 0 ||
    !Number.isInteger(doc.prizes.entryCount)
  )
    throw new Error("Number of entries must be a whole number (0 or more).");
  const percentSum = doc.prizes.places.reduce(
    (sum, place) => sum + place.percent,
    0,
  );
  for (const place of doc.prizes.places) {
    if (
      !Number.isFinite(place.percent) ||
      place.percent < 0 ||
      place.percent > 100
    )
      throw new Error("Each place percent must be between 0 and 100.");
  }
  if (Math.abs(percentSum - 100) > 0.001)
    throw new Error("Place percents must add up to 100%.");
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in doc)) delete record[key];
    }
    Object.assign(record, doc);
  }
}
