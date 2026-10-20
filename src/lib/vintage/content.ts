import { isAllowedVintageFont } from "./fonts";
import {
  defaultHomeCards,
  normalizeHomeCards,
  VINTAGE_HOME_CARD_SLOTS,
  type VintageHomeCard,
} from "./homeCards";
import { isAllowedToolbarIcon } from "./toolbarIcons";

export type {
  VintageChampEmblem,
  VintageChampYearStyle,
  VintageHomeCard,
  VintageHomeCardType,
} from "./homeCards";
export {
  CHAMP_MASTER_SRC,
  EXCEL_MASTER_SRC,
  excelCardVariant,
  excelPlateSrc,
  formatExcelComingSoonAt,
  HOME_CARD_TYPE_LABELS,
  PLAY_NOW_MASTER_SRC,
  VINTAGE_HOME_CARD_SLOTS,
} from "./homeCards";
export type { ExcelCardVariant } from "./homeCards";

/** One toolbar button. Empty label, href, or icon hides it on the page. */
export interface VintageToolbarItem {
  id: string;
  label: string;
  href: string;
  icon: string;
}

/** Site-wide vintage theme colors (hex) and four role-based fonts. */
export interface VintageTheme {
  primary: string;
  headline: string;
  background: string;
  /** 1st place / gold accents (trophies, standings). */
  first: string;
  /** 2nd place / silver accents. */
  second: string;
  /** 3rd place / bronze accents. */
  third: string;
  fonts: {
    /** Masthead nameplate (default Alfa Slab One). */
    headline: string;
    /** Toolbar icons/labels and display UI (default Oswald). */
    icons: string;
    /** Default body copy (default Arial). */
    body: string;
    /** Specialty article/body accents (default Georgia). */
    bodySpecialty: string;
  };
}

/** One panel in the Info / Hall of Fame explore band. */
export interface VintageExplorePanel {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Two-up navigation band under the main home cards (admined together).
 */
export interface VintageExploreBand {
  enabled: boolean;
  info: VintageExplorePanel;
  hall: VintageExplorePanel;
}

/** One line on the announcements board (date/time + message). */
export interface VintageAnnouncement {
  id: string;
  /** ISO datetime shown ahead of the message. */
  at: string;
  text: string;
}

/**
 * Full-width announcements board under the explore band.
 */
export interface VintageAnnouncementBoard {
  enabled: boolean;
  /** Board heading (e.g. ANNOUNCEMENTS). */
  title: string;
  items: VintageAnnouncement[];
}

export interface VintageContent {
  theme: VintageTheme;
  toolbar: VintageToolbarItem[];
  /** Three main homepage cards below the countdown (Play / Champ / Excel). */
  homeCards: VintageHomeCard[];
  /** Wide band under home cards: Info + Hall of Fame panels. */
  exploreBand: VintageExploreBand;
  /** Full-width announcements list under the explore band. */
  announcementBoard: VintageAnnouncementBoard;
  masthead: {
    first: string;
    second: string;
  };
  tournament: {
    /**
     * Active Tourney Year — sole source for vintage `{year}` / `<year>` tokens
     * and My Picks active-year mutations (not Config Sheet `tournament_year`).
     */
    year: string;
    title: string;
    dates: string;
    /** Homepage heading above the tipoff clock. Supports `{year}` / `<year>`. */
    countdownTitle: string;
    /**
     * Selection Sunday — when the bracket field is released (Brackets Ready).
     * Used by My Picks countdown before brackets are published.
     */
    bracketsReadyAt: string;
    /**
     * Round 1 tipoff (Thursday). Homepage countdown always targets this when on;
     * My Picks switches to it after brackets are published.
     */
    tipoffAt: string;
    countdownEnabled: boolean;
    /**
     * Shown in place of the clock when the countdown is off
     * (tournament is live / underway), and after tipoff on My Picks.
     * Supports `{year}` / `<year>`.
     */
    liveTourneyMessage: string;
    picksEnabled: boolean;
  };
  footer: {
    text: string;
    /** Mailto link label (envelope icon beside it). */
    contactLabel: string;
    contactEmail: string;
  };
}

export const VINTAGE_TOOLBAR_SLOTS = 8;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Build an empty toolbar slot for unused positions.
 */
export function emptyToolbarSlot(index: number): VintageToolbarItem {
  return {
    id: `slot-${index + 1}`,
    label: "",
    href: "",
    icon: "",
  };
}

/**
 * Default six navigation buttons plus two empty slots.
 */
export function defaultToolbar(): VintageToolbarItem[] {
  return [
    { id: "home", label: "Home", href: "/", icon: "House" },
    { id: "info", label: "Info", href: "/info", icon: "BookOpen" },
    { id: "history", label: "History", href: "/hall-of-fame", icon: "Trophy" },
    {
      id: "standings",
      label: "Standings",
      href: "/standings",
      icon: "custom:https://br-odd-rice-ad9n8mtb.storage.c-2.us-east-1.aws.neon.tech/vintage-homepage-media/vintage/d0229683-0185-4a87-827f-b6f36e38bc35.svg",
    },
    {
      id: "picks",
      label: "My Picks",
      href: "/bracket",
      icon: "custom:https://br-odd-rice-ad9n8mtb.storage.c-2.us-east-1.aws.neon.tech/vintage-homepage-media/vintage/4d089223-2cb7-4c29-a3df-4965266b0842.svg",
    },
    {
      id: "account",
      label: "Admin",
      href: "/admin",
      icon: "CircleUserRound",
    },
    emptyToolbarSlot(6),
    emptyToolbarSlot(7),
  ];
}

/**
 * True when a toolbar item should render on the public page.
 */
export function isToolbarItemPopulated(item: VintageToolbarItem): boolean {
  return Boolean(
    item.label.trim() && item.href.trim() && item.icon.trim(),
  );
}

/**
 * Normalize toolbar to exactly eight slots, preserving known items.
 */
export function normalizeToolbar(
  value: unknown,
): VintageToolbarItem[] {
  const defaults = defaultToolbar();
  if (!Array.isArray(value)) return defaults;
  const items: VintageToolbarItem[] = value.slice(0, VINTAGE_TOOLBAR_SLOTS).map(
    (raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const fallback = defaults[index] ?? emptyToolbarSlot(index);
      const id =
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : fallback.id;
      const href = typeof item.href === "string" ? item.href : "";
      let icon = typeof item.icon === "string" ? item.icon : "";
      // Align Info nav with the explore-band BookOpen (same /info destination).
      if (
        icon === "FileText" &&
        (id === "info" || href.trim() === "/info")
      ) {
        icon = "BookOpen";
      }
      return {
        id,
        label: typeof item.label === "string" ? item.label : "",
        href,
        icon,
      };
    },
  );
  while (items.length < VINTAGE_TOOLBAR_SLOTS) {
    items.push(emptyToolbarSlot(items.length));
  }
  return items;
}

/**
 * Normalize one explore-band panel from older CMS documents.
 */
function normalizeExplorePanel(
  value: unknown,
  fallback: VintageExplorePanel,
): VintageExplorePanel {
  if (!value || typeof value !== "object") return { ...fallback };
  const item = value as Record<string, unknown>;
  return {
    headline:
      typeof item.headline === "string" ? item.headline : fallback.headline,
    body: typeof item.body === "string" ? item.body : fallback.body,
    ctaLabel:
      typeof item.ctaLabel === "string" ? item.ctaLabel : fallback.ctaLabel,
    ctaHref: typeof item.ctaHref === "string" ? item.ctaHref : fallback.ctaHref,
  };
}

/**
 * Normalize the Info / Hall explore band (defaults when missing).
 */
export function normalizeExploreBand(value: unknown): VintageExploreBand {
  const defaults = DEFAULT_VINTAGE_CONTENT.exploreBand;
  if (!value || typeof value !== "object") {
    return structuredClone(defaults);
  }
  const item = value as Record<string, unknown>;
  return {
    enabled:
      typeof item.enabled === "boolean" ? item.enabled : defaults.enabled,
    info: normalizeExplorePanel(item.info, defaults.info),
    hall: normalizeExplorePanel(item.hall, defaults.hall),
  };
}

/**
 * Convert a legacy date-only string or ISO value into an ISO datetime.
 */
function normalizeAnnouncementAt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`;
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

/**
 * Normalize one announcement line from current or legacy CMS shapes.
 */
function normalizeAnnouncementItem(raw: unknown): VintageAnnouncement | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id =
    typeof item.id === "string" && item.id.trim()
      ? item.id.trim()
      : `ann-${Math.random().toString(36).slice(2, 10)}`;
  const at =
    normalizeAnnouncementAt(item.at) ||
    normalizeAnnouncementAt(item.date);
  const textParts: string[] = [];
  if (typeof item.text === "string" && item.text.trim()) {
    textParts.push(item.text.trim());
  }
  if (
    typeof item.headline === "string" &&
    item.headline.trim() &&
    !textParts.includes(item.headline.trim())
  ) {
    // Legacy dispatches used a separate title — fold into the body once.
    textParts.unshift(item.headline.trim());
  }
  const text = textParts.join(" — ");
  if (!at && !text) return null;
  return { id, at, text };
}

/**
 * Normalize the announcements board; migrates legacy `announcements` arrays.
 */
export function normalizeAnnouncementBoard(
  value: unknown,
  legacyAnnouncements?: unknown,
): VintageAnnouncementBoard {
  const defaults = DEFAULT_VINTAGE_CONTENT.announcementBoard;
  const fromBoard =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  const rawItems = Array.isArray(fromBoard?.items)
    ? fromBoard.items
    : Array.isArray(legacyAnnouncements)
      ? legacyAnnouncements
      : null;
  if (!fromBoard && rawItems == null) return structuredClone(defaults);
  const items = (rawItems ?? [])
    .map(normalizeAnnouncementItem)
    .filter((item): item is VintageAnnouncement => Boolean(item));
  return {
    enabled:
      typeof fromBoard?.enabled === "boolean"
        ? fromBoard.enabled
        : defaults.enabled,
    title:
      typeof fromBoard?.title === "string" && fromBoard.title.trim()
        ? fromBoard.title.trim()
        : defaults.title,
    items,
  };
}

/**
 * Format an announcement timestamp for the board (e.g. 10/15/26 12:00 pm EDT).
 */
export function formatAnnouncementAt(iso: string): string {
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

/**
 * Fill missing theme / toolbar (and related) fields for older CMS documents.
 */
export function normalizeVintageContent(value: unknown): VintageContent {
  const defaults = structuredClone(DEFAULT_VINTAGE_CONTENT);
  if (!value || typeof value !== "object") return defaults;
  const input = value as Partial<VintageContent> & Record<string, unknown>;
  const legacyAnnouncements = input.announcements;
  // Drop removed homepage sections so they cannot leak past normalize/validate.
  const {
    announcements: _legacyAnnouncements,
    hero: _legacyHero,
    history: _legacyHistory,
    promotions: _legacyPromotions,
    downloads: _legacyDownloads,
    introduction: _legacyIntroduction,
    ...inputRest
  } = input;
  const themeIn =
    input.theme && typeof input.theme === "object"
      ? (input.theme as Partial<VintageTheme> & {
          fonts?: Partial<VintageTheme["fonts"]>;
        })
      : {};
  const fontsIn: Partial<VintageTheme["fonts"]> =
    themeIn.fonts && typeof themeIn.fonts === "object" ? themeIn.fonts : {};
  return {
    ...defaults,
    ...inputRest,
    theme: {
      primary:
        typeof themeIn.primary === "string"
          ? themeIn.primary
          : defaults.theme.primary,
      headline:
        typeof themeIn.headline === "string"
          ? themeIn.headline
          : defaults.theme.headline,
      background:
        typeof themeIn.background === "string"
          ? themeIn.background
          : defaults.theme.background,
      first:
        typeof themeIn.first === "string"
          ? themeIn.first
          : defaults.theme.first,
      second:
        typeof themeIn.second === "string"
          ? themeIn.second
          : defaults.theme.second,
      third:
        typeof themeIn.third === "string"
          ? themeIn.third
          : defaults.theme.third,
      fonts: {
        headline:
          typeof fontsIn.headline === "string"
            ? fontsIn.headline
            : defaults.theme.fonts.headline,
        icons:
          typeof fontsIn.icons === "string"
            ? fontsIn.icons
            : defaults.theme.fonts.icons,
        body:
          typeof fontsIn.body === "string"
            ? fontsIn.body
            : defaults.theme.fonts.body,
        bodySpecialty:
          typeof fontsIn.bodySpecialty === "string"
            ? fontsIn.bodySpecialty
            : defaults.theme.fonts.bodySpecialty,
      },
    },
    toolbar: normalizeToolbar(input.toolbar),
    homeCards: normalizeHomeCards(input.homeCards),
    exploreBand: normalizeExploreBand(input.exploreBand),
    announcementBoard: normalizeAnnouncementBoard(
      input.announcementBoard,
      legacyAnnouncements,
    ),
    masthead: (() => {
      const mastheadIn =
        input.masthead && typeof input.masthead === "object"
          ? (input.masthead as Partial<VintageContent["masthead"]> &
              Record<string, unknown>)
          : {};
      return {
        first:
          typeof mastheadIn.first === "string"
            ? mastheadIn.first
            : defaults.masthead.first,
        second:
          typeof mastheadIn.second === "string"
            ? mastheadIn.second
            : defaults.masthead.second,
      };
    })(),
    tournament: (() => {
      const tournamentIn =
        input.tournament && typeof input.tournament === "object"
          ? (input.tournament as Partial<VintageContent["tournament"]> & {
              /** @deprecated Migrated to `tipoffAt`. */
              countdownAt?: string;
            })
          : {};
      const title =
        typeof tournamentIn.countdownTitle === "string"
          ? tournamentIn.countdownTitle.trim()
          : "";
      const liveMessage =
        typeof tournamentIn.liveTourneyMessage === "string"
          ? tournamentIn.liveTourneyMessage.trim()
          : "";
      const tipoffAt =
        typeof tournamentIn.tipoffAt === "string" && tournamentIn.tipoffAt.trim()
          ? tournamentIn.tipoffAt.trim()
          : typeof tournamentIn.countdownAt === "string"
            ? tournamentIn.countdownAt.trim()
            : defaults.tournament.tipoffAt;
      const bracketsReadyAt =
        typeof tournamentIn.bracketsReadyAt === "string"
          ? tournamentIn.bracketsReadyAt.trim()
          : defaults.tournament.bracketsReadyAt;
      const {
        countdownAt: _legacyCountdownAt,
        ...tournamentRest
      } = tournamentIn;
      const yearRaw =
        typeof tournamentIn.year === "string"
          ? tournamentIn.year.trim()
          : defaults.tournament.year;
      return {
        ...defaults.tournament,
        ...tournamentRest,
        year: /^\d{4}$/.test(yearRaw) ? yearRaw : defaults.tournament.year,
        countdownTitle: title || defaults.tournament.countdownTitle,
        liveTourneyMessage:
          liveMessage || defaults.tournament.liveTourneyMessage,
        tipoffAt,
        bracketsReadyAt,
      };
    })(),
    footer: (() => {
      const footerIn =
        input.footer && typeof input.footer === "object"
          ? (input.footer as Partial<VintageContent["footer"]>)
          : {};
      const contactLabel =
        typeof footerIn.contactLabel === "string"
          ? footerIn.contactLabel.trim()
          : "";
      return {
        ...defaults.footer,
        ...footerIn,
        contactLabel: contactLabel || defaults.footer.contactLabel,
      };
    })(),
  };
}

export const DEFAULT_VINTAGE_CONTENT: VintageContent = {
  theme: {
    primary: "#152c3a",
    headline: "#b52c26",
    background: "#f2ead8",
    first: "#c9a227",
    second: "#a8a9ad",
    third: "#cd7f32",
    fonts: {
      headline: "Alfa Slab One",
      icons: "Oswald",
      body: "Arial",
      bodySpecialty: "Georgia",
    },
  },
  toolbar: defaultToolbar(),
  homeCards: defaultHomeCards(),
  exploreBand: {
    enabled: true,
    info: {
      headline: "NEW AROUND HERE?",
      body: "Learn how to play, scoring rules, important dates, and everything you need to know to join in.",
      ctaLabel: "VISIT THE INFO PAGE",
      ctaHref: "/info",
    },
    hall: {
      headline: "THE HALL OF FAME",
      body: "Celebrate past champions, check out historical standings, and see the legends of Warren's March Madness.",
      ctaLabel: "EXPLORE THE HALL",
      ctaHref: "/hall-of-fame",
    },
  },
  announcementBoard: {
    enabled: true,
    title: "ANNOUNCEMENTS",
    items: [
      {
        id: "welcome",
        at: "2026-10-15T12:00:00.000Z",
        text: "Selection Sunday is March 14, 2027. Mark your calendar. Tell your friends.",
      },
    ],
  },
  masthead: {
    first: "WARREN’S",
    second: "MARCH MADNESS",
  },
  tournament: {
    year: "2027",
    title: "NCAA TOURNAMENT",
    dates: "A new chapter. The same madness.",
    countdownTitle: "Countdown to <year> tipoff",
    bracketsReadyAt: "2027-03-15T00:45:00.000Z",
    tipoffAt: "2027-03-18T16:15:00.000Z",
    countdownEnabled: true,
    liveTourneyMessage: "<year> Tourney Active!",
    picksEnabled: false,
  },
  footer: {
    text: "© Warren’s March Madness · A tradition since 2000.",
    contactLabel: "Contact the Commisioner",
    contactEmail: "ncaatourney@gmail.com",
  },
};

/**
 * True for empty, root-relative site paths, or credential-free HTTPS URLs.
 */
export function safeHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^\/(?![\/])[^\s\\]*$/.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Excel download links: site path, or http(s) URL (files often live on plain http hosts).
 */
export function safeExcelDownloadHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  // Protocol-relative URLs (//host/…) are not allowed.
  if (trimmed.startsWith("//")) return false;
  if (/^\/(?![\/])[^\s\\]*$/.test(trimmed)) return true;
  // Relative path without a leading slash — treat as a site path.
  if (
    !trimmed.startsWith("/") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(trimmed) &&
    !trimmed.includes("\\") &&
    !/\s/.test(trimmed)
  ) {
    return /^\/(?![\/])[^\s\\]*$/.test(`/${trimmed}`);
  }
  try {
    const u = new URL(trimmed);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}

/** Strictly validate the document before it can become a draft or publication. */
export function validateVintageContent(
  value: unknown,
): asserts value is VintageContent {
  const normalized = normalizeVintageContent(value);
  function shape(actual: unknown, sample: unknown, path: string): void {
    if (Array.isArray(sample)) {
      const maxLen = path === "announcementBoard.items" ? 100 : 30;
      if (!Array.isArray(actual) || actual.length > maxLen)
        throw new Error(`${path}: invalid list.`);
      if (path === "toolbar" && actual.length !== VINTAGE_TOOLBAR_SLOTS)
        throw new Error(`Toolbar must have exactly ${VINTAGE_TOOLBAR_SLOTS} slots.`);
      if (path === "homeCards" && actual.length !== VINTAGE_HOME_CARD_SLOTS)
        throw new Error(
          `Home cards must have exactly ${VINTAGE_HOME_CARD_SLOTS} slots.`,
        );
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
    if (typeof actual === "string") {
      if (actual.length > 6000) throw new Error(`${path}: text is too long.`);
      const isExcelDownloadHref =
        path.endsWith("excelPicksHref") || path.endsWith("excelTrackerHref");
      if (isExcelDownloadHref && !safeExcelDownloadHref(actual)) {
        throw new Error(
          `${path}: use a site path (e.g. /files/picks.xlsx) or an http(s) URL.`,
        );
      }
      if (
        !isExcelDownloadHref &&
        (path.endsWith("Href") ||
          path.endsWith(".href") ||
          path.endsWith(".src") ||
          path.endsWith("ImageSrc")) &&
        !safeHref(actual)
      )
        throw new Error(`${path}: use a local path or an HTTPS URL.`);
    }
  }
  shape(normalized, DEFAULT_VINTAGE_CONTENT, "");
  const doc = normalized;
  if (!doc.masthead.first.trim() || !doc.masthead.second.trim())
    throw new Error("Masthead lines cannot be blank.");
  if (!doc.tournament.year.trim() || !/^\d{4}$/.test(doc.tournament.year.trim()))
    throw new Error("Active Tourney Year must be a four-digit year.");
  if (!doc.tournament.countdownTitle.trim())
    throw new Error("Countdown title cannot be blank.");
  if (!doc.tournament.liveTourneyMessage.trim())
    throw new Error("Live tourney message cannot be blank.");
  if (
    doc.footer.contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.footer.contactEmail)
  )
    throw new Error("Enter a valid contact email.");
  const isoWithTz = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/;
  if (doc.tournament.tipoffAt && !isoWithTz.test(doc.tournament.tipoffAt))
    throw new Error("Tourney tipoff needs an ISO date with timezone.");
  if (
    doc.tournament.bracketsReadyAt &&
    !isoWithTz.test(doc.tournament.bracketsReadyAt)
  )
    throw new Error("Brackets Ready needs an ISO date with timezone.");
  if (
    doc.tournament.countdownEnabled &&
    (!doc.tournament.tipoffAt ||
      !Number.isFinite(Date.parse(doc.tournament.tipoffAt)))
  )
    throw new Error("Set a valid Tourney Tipoff date to show the countdown.");
  for (const [index, item] of doc.announcementBoard.items.entries()) {
    if (!item.at.trim() || !Number.isFinite(Date.parse(item.at))) {
      throw new Error(
        `Announcement ${index + 1} needs a valid date and time.`,
      );
    }
    if (!item.text.trim()) {
      throw new Error(`Announcement ${index + 1} needs a message.`);
    }
  }
  if (
    !HEX.test(doc.theme.primary) ||
    !HEX.test(doc.theme.headline) ||
    !HEX.test(doc.theme.background) ||
    !HEX.test(doc.theme.first) ||
    !HEX.test(doc.theme.second) ||
    !HEX.test(doc.theme.third)
  )
    throw new Error("Theme colors must be six-digit hex values like #152c3a.");
  for (const [role, fontId] of Object.entries(doc.theme.fonts)) {
    if (!isAllowedVintageFont(fontId))
      throw new Error(`Theme font "${role}" is not in the available catalog.`);
  }
  for (const [index, item] of doc.toolbar.entries()) {
    if (!isAllowedToolbarIcon(item.icon))
      throw new Error(`Toolbar slot ${index + 1}: unknown icon.`);
    if (item.label.length > 40)
      throw new Error(`Toolbar slot ${index + 1}: caption is too long.`);
    if (
      isToolbarItemPopulated(item) === false &&
      (item.label.trim() || item.href.trim() || item.icon.trim())
    ) {
      // Partially filled slots are allowed in draft editing; hide on page.
      // Still require safe href when present.
    }
  }
  // Assign normalized fields onto the caller's object when it is a plain object,
  // so save paths persist theme/toolbar even when they were missing. Drop keys
  // that were removed from the schema (legacy hero / promotions / etc.).
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in doc)) delete record[key];
    }
    Object.assign(record, doc);
  }
}
