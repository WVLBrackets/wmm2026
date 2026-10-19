import type { HallOfFameEntry } from "@/lib/googleSheets";

/** Dollars per entry for historical prize-pool math (matches legacy HoF). */
export const HOF_ENTRY_FEE = 5;

export type HofYearKind =
  | "normal"
  | "cancelled2020"
  | "hiatus2016"
  | "hiatus";

export interface HofFinisher {
  name: string;
  points: number;
  place: 1 | 2 | 3;
}

export interface HofSeasonCard {
  year: string;
  kind: HofYearKind;
  /** Null when unknown / not applicable. */
  entryCount: number | null;
  ncaaChampionTeam: string | null;
  finishers: HofFinisher[];
}

export interface HofReigningChampion {
  name: string;
  year: string;
  points: number | null;
  entryCount: number | null;
}

export interface HofLifetimeStats {
  tournamentsCompleted: number;
  uniqueMoneyWinners: number;
  /** Null when no known entry counts exist. */
  totalEntries: number | null;
  /** Null when total entries unknown. */
  totalPrizeDollars: number | null;
}

export interface HofCareerLeader {
  name: string;
  totalWinnings: number;
  finishes: {
    year: string;
    place: 1 | 2 | 3;
    points: number;
    winnings: number;
  }[];
}

export interface HofSingleSeasonLeader {
  name: string;
  year: string;
  points: number;
  place: 1 | 2 | 3;
}

export interface HofViewModel {
  reigningChampion: HofReigningChampion | null;
  lifetime: HofLifetimeStats;
  seasons: HofSeasonCard[];
  careerLeaders: HofCareerLeader[];
  singleSeasonLeaders: HofSingleSeasonLeader[];
}

/**
 * True when a sheet year is not a completed WMM tournament.
 */
export function isHofSpecialYear(entry: HallOfFameEntry): boolean {
  return classifyHofYear(entry) !== "normal";
}

/**
 * Classify a Hall of Fame sheet row for display and stats.
 */
export function classifyHofYear(entry: HallOfFameEntry): HofYearKind {
  if (entry.year === "2020") return "cancelled2020";
  if (entry.year === "2016") return "hiatus2016";
  if (entry.firstPlace.name.trim().toUpperCase() === "HIATUS") return "hiatus";
  return "normal";
}

/**
 * Entry count for display: null when missing or zero (unknown).
 */
export function hofKnownEntryCount(totalEntries: number): number | null {
  if (!Number.isFinite(totalEntries) || totalEntries <= 0) return null;
  return Math.floor(totalEntries);
}

/**
 * Build season cards in sheet order (expected reverse chronological).
 */
export function buildHofSeasonCards(
  entries: HallOfFameEntry[],
): HofSeasonCard[] {
  return entries.map((entry) => {
    const kind = classifyHofYear(entry);
    if (kind === "cancelled2020") {
      return {
        year: entry.year,
        kind,
        entryCount: null,
        ncaaChampionTeam: null,
        finishers: [],
      };
    }
    if (kind === "hiatus2016") {
      const team = entry.firstPlace.team?.trim() || null;
      return {
        year: entry.year,
        kind,
        entryCount: null,
        ncaaChampionTeam: team,
        finishers: [],
      };
    }
    if (kind === "hiatus") {
      return {
        year: entry.year,
        kind,
        entryCount: null,
        ncaaChampionTeam: null,
        finishers: [],
      };
    }
    return {
      year: entry.year,
      kind,
      entryCount: hofKnownEntryCount(entry.totalEntries),
      ncaaChampionTeam: entry.firstPlace.team?.trim() || null,
      finishers: [
        {
          name: entry.firstPlace.name,
          points: entry.firstPlace.score,
          place: 1,
        },
        {
          name: entry.secondPlace.name,
          points: entry.secondPlace.score,
          place: 2,
        },
        {
          name: entry.thirdPlace.name,
          points: entry.thirdPlace.score,
          place: 3,
        },
      ],
    };
  });
}

/**
 * Reigning champion from the first completed WMM year in sheet order.
 */
export function resolveHofReigningChampion(
  entries: HallOfFameEntry[],
): HofReigningChampion | null {
  const entry = entries.find((item) => !isHofSpecialYear(item));
  if (!entry) return null;
  return {
    name: entry.firstPlace.name,
    year: entry.year,
    points: entry.firstPlace.score > 0 ? entry.firstPlace.score : null,
    entryCount: hofKnownEntryCount(entry.totalEntries),
  };
}

/**
 * Lifetime strip stats — special years excluded consistently.
 */
export function computeHofLifetimeStats(
  entries: HallOfFameEntry[],
): HofLifetimeStats {
  const completed = entries.filter((entry) => !isHofSpecialYear(entry));
  const winners = new Set<string>();
  let knownEntriesSum = 0;
  let hasKnownEntries = false;
  for (const entry of completed) {
    winners.add(entry.firstPlace.name);
    winners.add(entry.secondPlace.name);
    winners.add(entry.thirdPlace.name);
    const known = hofKnownEntryCount(entry.totalEntries);
    if (known !== null) {
      hasKnownEntries = true;
      knownEntriesSum += known;
    }
  }
  return {
    tournamentsCompleted: completed.length,
    uniqueMoneyWinners: winners.size,
    totalEntries: hasKnownEntries ? knownEntriesSum : null,
    totalPrizeDollars: hasKnownEntries
      ? knownEntriesSum * HOF_ENTRY_FEE
      : null,
  };
}

/**
 * Career winnings leaders (top 25 by total $). Place order preserved in finishes.
 */
export function computeHofCareerLeaders(
  entries: HallOfFameEntry[],
): HofCareerLeader[] {
  const map = new Map<string, HofCareerLeader>();

  /**
   * Accrue one podium finish into the career map.
   */
  function addFinish(
    name: string,
    year: string,
    place: 1 | 2 | 3,
    points: number,
    entriesCount: number,
    share: number,
  ) {
    if (!name.trim() || name.trim().toUpperCase() === "HIATUS") return;
    const winnings = entriesCount * HOF_ENTRY_FEE * share;
    let row = map.get(name);
    if (!row) {
      row = { name, totalWinnings: 0, finishes: [] };
      map.set(name, row);
    }
    row.totalWinnings += winnings;
    row.finishes.push({ year, place, points, winnings });
  }

  for (const entry of entries) {
    if (isHofSpecialYear(entry)) continue;
    const count = entry.totalEntries > 0 ? entry.totalEntries : 0;
    addFinish(
      entry.firstPlace.name,
      entry.year,
      1,
      entry.firstPlace.score,
      count,
      0.6,
    );
    addFinish(
      entry.secondPlace.name,
      entry.year,
      2,
      entry.secondPlace.score,
      count,
      0.3,
    );
    addFinish(
      entry.thirdPlace.name,
      entry.year,
      3,
      entry.thirdPlace.score,
      count,
      0.1,
    );
  }

  return Array.from(map.values())
    .map((leader) => ({
      ...leader,
      finishes: [...leader.finishes].sort(
        (a, b) => parseInt(b.year, 10) - parseInt(a.year, 10),
      ),
    }))
    .sort((a, b) => b.totalWinnings - a.totalWinnings)
    .slice(0, 25);
}

/**
 * Single-season point leaders (top 25). Points desc; sheet place kept on each row.
 */
export function computeHofSingleSeasonLeaders(
  entries: HallOfFameEntry[],
): HofSingleSeasonLeader[] {
  const records: HofSingleSeasonLeader[] = [];
  for (const entry of entries) {
    if (isHofSpecialYear(entry)) continue;
    records.push({
      name: entry.firstPlace.name,
      year: entry.year,
      points: entry.firstPlace.score,
      place: 1,
    });
    records.push({
      name: entry.secondPlace.name,
      year: entry.year,
      points: entry.secondPlace.score,
      place: 2,
    });
    records.push({
      name: entry.thirdPlace.name,
      year: entry.year,
      points: entry.thirdPlace.score,
      place: 3,
    });
  }
  return records.sort((a, b) => b.points - a.points).slice(0, 25);
}

/**
 * Full Hall of Fame view model from raw sheet rows.
 */
export function buildHofViewModel(entries: HallOfFameEntry[]): HofViewModel {
  return {
    reigningChampion: resolveHofReigningChampion(entries),
    lifetime: computeHofLifetimeStats(entries),
    seasons: buildHofSeasonCards(entries),
    careerLeaders: computeHofCareerLeaders(entries),
    singleSeasonLeaders: computeHofSingleSeasonLeaders(entries),
  };
}

/**
 * Format whole dollars for HoF displays.
 */
export function formatHofDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
