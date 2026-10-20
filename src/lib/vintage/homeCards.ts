export const VINTAGE_HOME_CARD_SLOTS = 3;

export type VintageHomeCardType =
  | "playNow"
  | "reigningChamp"
  | "excelDownloads";

/** Fixed display order for the three main home cards. */
export const HOME_CARD_SLOT_TYPES: VintageHomeCardType[] = [
  "playNow",
  "reigningChamp",
  "excelDownloads",
];

/** Gold crest style on the Reigning Champ card. */
export type VintageChampEmblem =
  | "wreathClassic"
  | "wreathOpen"
  | "trophyPedestal"
  | "trophyCircle"
  | "sealHex"
  | "sunburst";

const CHAMP_EMBLEMS: VintageChampEmblem[] = [
  "wreathClassic",
  "wreathOpen",
  "trophyPedestal",
  "trophyCircle",
  "sealHex",
  "sunburst",
];

/**
 * Champ wreath year treatment — locked to straight Alfa Slab.
 * Field kept on the card shape for CMS payload compatibility.
 */
export type VintageChampYearStyle = "straight";

/** Bundled Play Now master art (used when `playImageSrc` is empty). */
export const PLAY_NOW_MASTER_SRC = "/images/vintage/card-play-now-master.jpg";

/** Bundled Reigning Champ master art (used when `champImageSrc` is empty). */
export const CHAMP_MASTER_SRC = "/images/vintage/card-champ-master.jpg";

/** Excel card plate variants (chosen from download paths). */
export type ExcelCardVariant = "neither" | "picks" | "both";

/** Bundled Excel Downloads masters for each availability scenario. */
export const EXCEL_MASTER_SRC: Record<ExcelCardVariant, string> = {
  neither: "/images/vintage/card-excel-neither.jpg",
  picks: "/images/vintage/card-excel-picks.jpg",
  both: "/images/vintage/card-excel-both.jpg",
};

/**
 * Pick the Excel plate from which download paths are set.
 * Tracker-only is not a supported case — falls back to “neither.”
 */
export function excelCardVariant(card: {
  excelPicksHref: string;
  excelTrackerHref: string;
}): ExcelCardVariant {
  const picks = Boolean(card.excelPicksHref?.trim());
  const tracker = Boolean(card.excelTrackerHref?.trim());
  if (picks && tracker) return "both";
  if (picks) return "picks";
  return "neither";
}

/**
 * Resolve Excel plate art: CMS upload for the active variant, else bundled master.
 */
export function excelPlateSrc(card: {
  excelPicksHref: string;
  excelTrackerHref: string;
  excelNeitherImageSrc?: string;
  excelPicksImageSrc?: string;
  excelBothImageSrc?: string;
}): string {
  const variant = excelCardVariant(card);
  const custom =
    variant === "both"
      ? card.excelBothImageSrc?.trim()
      : variant === "picks"
        ? card.excelPicksImageSrc?.trim()
        : card.excelNeitherImageSrc?.trim();
  return custom || EXCEL_MASTER_SRC[variant];
}

/**
 * Normalize an Excel download href: trim, and prefix `/` for relative site paths.
 */
export function normalizeExcelHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return trimmed; // leave invalid; validator rejects
  if (trimmed.startsWith("/")) return trimmed;
  if (
    !/^[a-z][a-z0-9+.-]*:/i.test(trimmed) &&
    !trimmed.includes("\\") &&
    !/\s/.test(trimmed)
  ) {
    return `/${trimmed}`;
  }
  return trimmed;
}

/**
 * Format an ISO timestamp for Excel “Coming Soon” (e.g. 3/14/26 8:00 pm EST).
 * Uses America/New_York so the abbrev is EST/EDT.
 */
export function formatExcelComingSoonAt(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const dayPeriod = get("dayPeriod").toLowerCase();
  const tz = get("timeZoneName") || "ET";
  return `${get("month")}/${get("day")}/${get("year")} ${get("hour")}:${get("minute")} ${dayPeriod} ${tz}`;
}

/** One homepage card slot below the countdown. */
export interface VintageHomeCard {
  id: string;
  type: VintageHomeCardType;
  enabled: boolean;
  /** Play now — exact art; optional replacement image URL. */
  playImageSrc: string;
  playHref: string;
  /** @deprecated Kept for older CMS docs; not shown in admin. */
  playRibbon: string;
  /** @deprecated Baked into master art; not shown in admin. */
  playTitle: string;
  /** @deprecated Baked into master art; not shown in admin. */
  playSubtitle: string;
  /**
   * Footer caption hole (shared CardFooterCaption pattern with Champ / Excel).
   * ALL CAPS on render; use `||` for a two-line break.
   */
  playCtaLabel: string;
  /** Reigning champ — master art + name / year / motto holes. */
  champImageSrc: string;
  champYear: string;
  champName: string;
  champMotto: string;
  /** Year treatment mockup inside the wreath. */
  champYearStyle: VintageChampYearStyle;
  /** @deprecated Wreath is baked into master art; kept for older CMS docs. */
  champEmblem: VintageChampEmblem;
  /** Excel downloads — caption, two file paths, optional coming-soon datetimes. */
  excelCaption: string;
  excelPicksHref: string;
  excelTrackerHref: string;
  /** ISO datetime; shown under Coming Soon when that side has no path. */
  excelPicksAvailableAt: string;
  excelTrackerAvailableAt: string;
  /** Optional CMS overrides for the three scenario masters (empty = bundled). */
  excelNeitherImageSrc: string;
  excelPicksImageSrc: string;
  excelBothImageSrc: string;
  /** @deprecated Replaced by per-variant image fields; kept for older CMS docs. */
  excelImageSrc: string;
  /** @deprecated Labels are baked into master art. */
  excelPicksLabel: string;
  excelTrackerLabel: string;
  /** @deprecated Combined download removed. */
  excelCombinedLabel: string;
  excelCombinedHref: string;
  /** @deprecated Placeholder cards removed. */
  placeholderTitle: string;
}

export const HOME_CARD_TYPE_LABELS: Record<VintageHomeCardType, string> = {
  playNow: "Play now",
  reigningChamp: "Reigning Champ",
  excelDownloads: "Excel downloads",
};

/**
 * Empty field defaults shared by every card shape.
 */
function blankFields(): Omit<VintageHomeCard, "id" | "type" | "enabled"> {
  return {
    playImageSrc: "",
    playHref: "/auth/signin",
    playRibbon: "YOUR BRACKET STARTS HERE",
    playTitle: "Play now",
    playSubtitle: "Sign in or create an account to fill out your bracket.",
    playCtaLabel: "STEP INTO THE TOURNAMENT",
    champImageSrc: "",
    champYear: "2026",
    champName: "JARED INGRAM",
    champMotto: "Go Blue",
    champYearStyle: "straight",
    champEmblem: "wreathClassic",
    excelCaption: "Prefer the old school?",
    excelPicksHref: "",
    excelTrackerHref: "",
    excelPicksAvailableAt: "2027-03-14T23:00:00.000Z",
    excelTrackerAvailableAt: "2027-03-18T16:15:00.000Z",
    excelNeitherImageSrc: "",
    excelPicksImageSrc: "",
    excelBothImageSrc: "",
    excelImageSrc: "",
    excelPicksLabel: "Excel Picks Sheet",
    excelTrackerLabel: "Excel Tournament Tracker",
    excelCombinedLabel: "Picks + Tracker (combined)",
    excelCombinedHref: "",
    placeholderTitle: "Coming soon",
  };
}

/**
 * Build a card of the given type with sensible defaults.
 */
export function createHomeCard(
  type: VintageHomeCardType,
  index: number,
  enabled = true,
): VintageHomeCard {
  const fields = blankFields();
  if (type === "playNow") {
    fields.playImageSrc =
      "https://br-odd-rice-ad9n8mtb.storage.c-2.us-east-1.aws.neon.tech/vintage-homepage-media/vintage/7ed9ee88-622e-434e-9deb-25c92912dd2c.png";
    fields.playRibbon = "Your Bracket Starts Here";
    fields.playSubtitle = "";
    fields.excelCaption = "Excel formats available here.";
    fields.excelPicksAvailableAt = "";
    fields.excelTrackerAvailableAt = "";
  } else if (type === "reigningChamp") {
    fields.champImageSrc =
      "https://br-odd-rice-ad9n8mtb.storage.c-2.us-east-1.aws.neon.tech/vintage-homepage-media/vintage/8aa3141c-795d-4104-9c13-fd144e759816.png";
    fields.champName = "jared||ingram";
    fields.champEmblem = "sunburst";
    fields.excelCaption = "Excel formats available here.";
    fields.excelPicksAvailableAt = "";
    fields.excelTrackerAvailableAt = "";
  }
  return {
    id: `${type}-${index + 1}`,
    type,
    enabled,
    ...fields,
  };
}

/**
 * Default three homepage cards: Play Now, Champ, Excel.
 */
export function defaultHomeCards(): VintageHomeCard[] {
  return HOME_CARD_SLOT_TYPES.map((type, index) =>
    createHomeCard(type, index, true),
  );
}

/**
 * Normalize one raw CMS card into field defaults (type may be legacy).
 */
function normalizeCardFields(
  raw: unknown,
  fallback: VintageHomeCard,
): Omit<VintageHomeCard, "id" | "type" | "enabled"> & {
  id: string;
  enabled: boolean;
} {
  const item =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fields = blankFields();
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    if (key === "champEmblem") {
      if (
        typeof item.champEmblem === "string" &&
        CHAMP_EMBLEMS.includes(item.champEmblem as VintageChampEmblem)
      ) {
        fields.champEmblem = item.champEmblem as VintageChampEmblem;
      }
      continue;
    }
    if (key === "champYearStyle") {
      // Always straight slab — ignore legacy mockup values from older CMS saves.
      fields.champYearStyle = "straight";
      continue;
    }
    if (typeof item[key] === "string") fields[key] = item[key] as string;
  }
  fields.excelPicksHref = normalizeExcelHref(fields.excelPicksHref);
  fields.excelTrackerHref = normalizeExcelHref(fields.excelTrackerHref);
  return {
    id:
      typeof item.id === "string" && item.id.trim() ? item.id : fallback.id,
    enabled:
      typeof item.enabled === "boolean" ? item.enabled : fallback.enabled,
    ...fields,
  };
}

/**
 * Normalize to exactly three cards (Play / Champ / Excel), recovering fields
 * from older nine-slot CMS documents when possible.
 */
export function normalizeHomeCards(value: unknown): VintageHomeCard[] {
  const defaults = defaultHomeCards();
  if (!Array.isArray(value)) return defaults;

  const rawList = value.filter(
    (raw) => raw && typeof raw === "object",
  ) as Record<string, unknown>[];

  return HOME_CARD_SLOT_TYPES.map((type, index) => {
    const fallback = defaults[index];
    const match =
      rawList.find((item) => item.type === type) ??
      (rawList[index]?.type === type ? rawList[index] : undefined) ??
      rawList[index];
    const normalized = normalizeCardFields(match ?? {}, fallback);
    return {
      ...normalized,
      id: normalized.id.startsWith(type)
        ? normalized.id
        : fallback.id,
      type,
      enabled: true,
    };
  });
}
