export interface VintageImage {
  src: string;
  alt: string;
  position: string;
}
export interface VintagePromotion {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  text: string;
  image: VintageImage;
  href: string;
  linkLabel: string;
}
export interface VintageContent {
  masthead: {
    first: string;
    second: string;
    tagline: string;
    established: string;
    slogan: string;
  };
  hero: {
    headline: string;
    subtitle: string;
    image: VintageImage;
    ctaLabel: string;
    ctaHref: string;
  };
  tournament: {
    year: string;
    title: string;
    dates: string;
    countdownAt: string;
    countdownEnabled: boolean;
    picksEnabled: boolean;
  };
  introduction: { eyebrow: string; headline: string; body: string };
  announcements: { id: string; date: string; headline: string; text: string }[];
  history: {
    eyebrow: string;
    headline: string;
    text: string;
    winner: string;
    winnerYear: string;
    entries: string;
  };
  promotions: [VintagePromotion, VintagePromotion];
  downloads: [
    { label: string; description: string; href: string },
    { label: string; description: string; href: string },
  ];
  footer: { text: string; contactEmail: string };
}
export const DEFAULT_VINTAGE_CONTENT: VintageContent = {
  masthead: {
    first: "WARREN’S",
    second: "MARCH MADNESS",
    tagline: "A bracket pool for friends, family and college hoops fans",
    established: "EST. 2001",
    slogan: "ALL HOOPS. NO BS.",
  },
  hero: {
    headline: "BRACKETS\nBRING\nPEOPLE\nTOGETHER.",
    subtitle: "Same tradition. Bigger madness.",
    image: {
      src: "/images/vintage/basketball-editorial.webp",
      alt: "Vintage-style illustration of a basketball player reaching for the basket",
      position: "center",
    },
    ctaLabel: "Explore the pool",
    ctaHref: "/info",
  },
  tournament: {
    year: "2027",
    title: "NCAA TOURNAMENT",
    dates: "A new chapter. The same madness.",
    countdownAt: "",
    countdownEnabled: false,
    picksEnabled: false,
  },
  introduction: {
    eyebrow: "THE HOME OF MARCH",
    headline: "One tournament.\nCountless stories.",
    body: "The upsets. The buzzer-beaters. The picks you knew you should have made. Welcome to Warren’s March Madness — a tradition bringing friends and family together since 2001.",
  },
  announcements: [
    {
      id: "welcome",
      date: "2026-10-15",
      headline: "A new look. A familiar tradition.",
      text: "A fresh front page for a tradition that never gets old. Watch this space for tournament news and updates from the pool.",
    },
  ],
  history: {
    eyebrow: "FROM THE ARCHIVES",
    headline: "Legends live here.",
    text: "Every March writes a new story. Take a look back at the names that made pool history.",
    winner: "",
    winnerYear: "",
    entries: "",
  },
  promotions: [
    {
      enabled: true,
      eyebrow: "A WORD FROM OUR FRIENDS",
      headline: "Your next great\ngetaway.",
      text: "A featured getaway from our friends. Photographs, property details and a little inspiration — coming soon.",
      image: { src: "", alt: "", position: "center" },
      href: "",
      linkLabel: "Explore the property",
    },
    {
      enabled: true,
      eyebrow: "THE CLASSIFIEDS",
      headline: "A place worth\ntalking about.",
      text: "Good places. Great company. Discover another featured property from our friends. Details coming soon.",
      image: { src: "", alt: "", position: "center" },
      href: "",
      linkLabel: "Find out more",
    },
  ],
  downloads: [
    {
      label: "Excel Picks Sheet",
      description: "Plan your picks, your way.",
      href: "",
    },
    {
      label: "Excel Tournament Tracker",
      description: "Follow every twist of the tournament.",
      href: "",
    },
  ],
  footer: {
    text: "© Warren’s March Madness · A tradition since 2001.",
    contactEmail: "",
  },
};
export function safeHref(value: string): boolean {
  if (!value) return true;
  if (/^\/(?![\/])[^\\\s]*$/.test(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
/** Strictly validate the document before it can become a draft or publication. */
export function validateVintageContent(
  value: unknown,
): asserts value is VintageContent {
  if (!value || typeof value !== "object")
    throw new Error("Content must be an object.");
  function shape(actual: unknown, sample: unknown, path: string): void {
    if (Array.isArray(sample)) {
      if (!Array.isArray(actual) || actual.length > 30)
        throw new Error(`${path}: invalid list.`);
      if (path === "promotions" && actual.length !== 2)
        throw new Error("Exactly two promotions are required.");
      if (path === "downloads" && actual.length !== 2)
        throw new Error("Both Excel resources are required.");
      actual.forEach((item, index) =>
        shape(item, sample[0], `${path}.${index}`),
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
      if (
        (path.endsWith("Href") ||
          path.endsWith(".href") ||
          path.endsWith(".src")) &&
        !safeHref(actual)
      )
        throw new Error(`${path}: use a local path or an HTTPS URL.`);
    }
  }
  shape(value, DEFAULT_VINTAGE_CONTENT, "");
  const doc = value as VintageContent;
  if (
    !doc.hero.headline.trim() ||
    !doc.masthead.first.trim() ||
    !doc.masthead.second.trim()
  )
    throw new Error("Masthead and lead headline cannot be blank.");
  for (const image of [doc.hero.image, ...doc.promotions.map((p) => p.image)]) {
    if (image.src && !image.alt.trim())
      throw new Error("Every image requires alt text.");
    if (!["center", "top", "bottom", "left", "right"].includes(image.position))
      throw new Error("Invalid image position.");
  }
  if (
    doc.footer.contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.footer.contactEmail)
  )
    throw new Error("Enter a valid contact email.");
  if (
    doc.tournament.countdownAt &&
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(
      doc.tournament.countdownAt,
    )
  )
    throw new Error("Countdown needs an ISO date with timezone.");
  if (
    doc.tournament.countdownEnabled &&
    (!doc.tournament.countdownAt ||
      !Number.isFinite(Date.parse(doc.tournament.countdownAt)))
  )
    throw new Error("Set a valid countdown date.");
  for (const a of doc.announcements)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(a.date) ||
      !Number.isFinite(Date.parse(a.date))
    )
      throw new Error("Announcement dates must use YYYY-MM-DD.");
}
