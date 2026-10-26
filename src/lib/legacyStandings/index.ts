/**
 * Frozen final standings for years before live KEY snapshots (≤2025).
 * Built from legacy Webnode finals pages + hardcoded Final Four results.
 */

import type { StandingsData } from "@/lib/standingsData";
import standings2017 from "./data/2017.json";
import standings2018 from "./data/2018.json";
import standings2019 from "./data/2019.json";
import standings2021 from "./data/2021.json";
import standings2022 from "./data/2022.json";
import standings2023 from "./data/2023.json";
import standings2024 from "./data/2024.json";
import standings2025 from "./data/2025.json";
import { isLegacyStandingsYear } from "./years";

export {
  isLegacyStandingsYear,
  isNewspaperStandingsYear,
  listLegacyStandingsYears,
  listNewspaperStandingsYears,
  listStandingsArchiveYears,
  LAST_LEGACY_STANDINGS_YEAR,
  LEGACY_STANDINGS_YEARS,
  NEWSPAPER_STANDINGS_YEARS,
} from "./years";

const ARCHIVES: Record<number, StandingsData> = {
  2017: standings2017 as unknown as StandingsData,
  2018: standings2018 as unknown as StandingsData,
  2019: standings2019 as unknown as StandingsData,
  2021: standings2021 as unknown as StandingsData,
  2022: standings2022 as unknown as StandingsData,
  2023: standings2023 as unknown as StandingsData,
  2024: standings2024 as unknown as StandingsData,
  2025: standings2025 as unknown as StandingsData,
};

/**
 * Load a frozen final snapshot, or null when that year is not archived.
 *
 * @param year - Tournament / standings year
 */
export function getLegacyStandings(year: number): StandingsData | null {
  if (!isLegacyStandingsYear(year)) return null;
  const data = ARCHIVES[year];
  return data ? structuredClone(data) : null;
}
