/**
 * CMS copy for the vintage Hall of Fame page (not historical records —
 * those stay in Google Sheets).
 */
export interface VintageHofContent {
  heading: string;
  supporting: string;
  reigningLabel: string;
  archiveHeading: string;
  leadersHeading: string;
  careerHeading: string;
  careerSubtitle: string;
  singleSeasonHeading: string;
  singleSeasonSubtitle: string;
  closing: string;
  showMoreLabel: string;
  showFewerLabel: string;
  viewTop25Label: string;
  showTop5Label: string;
}

export const DEFAULT_VINTAGE_HOF_CONTENT: VintageHofContent = {
  heading: "Hall of Fame",
  supporting: "",
  reigningLabel: "Reigning Champion",
  archiveHeading: "Champions by Year",
  leadersHeading: "All-Time Leaders",
  careerHeading: "Career Winnings",
  careerSubtitle: "Total prize money earned.",
  singleSeasonHeading: "Single-Season Points",
  singleSeasonSubtitle: "Highest point totals in one tournament.",
  closing: "Every March adds another chapter.",
  showMoreLabel: "Show More Years",
  showFewerLabel: "Show Fewer Years",
  viewTop25Label: "View Top 25 →",
  showTop5Label: "Show Top 5",
};

/**
 * Fill missing HoF CMS fields from defaults.
 */
export function normalizeVintageHofContent(value: unknown): VintageHofContent {
  const defaults = structuredClone(DEFAULT_VINTAGE_HOF_CONTENT);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const input = value as Partial<VintageHofContent>;
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof VintageHofContent)[]) {
    if (typeof input[key] === "string") next[key] = input[key] as string;
  }
  return next;
}

/**
 * Validate HoF CMS copy before save/publish.
 */
export function validateVintageHofContent(
  value: unknown,
): asserts value is VintageHofContent {
  const doc = normalizeVintageHofContent(value);
  if (!doc.heading.trim()) throw new Error("Hall of Fame heading cannot be blank.");
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in doc)) delete record[key];
    }
    Object.assign(record, doc);
  }
}
