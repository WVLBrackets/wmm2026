import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import VintageLiveStandings from "@/components/vintage/standings/VintageLiveStandings";
import { listLiveStandingsYears } from "@/lib/repositories/liveStandingsSnapshotRepository";
import { listStandingsArchiveYears } from "@/lib/legacyStandings/years";
import {
  mergeAvailableYears,
  parseViewingYear,
} from "@/lib/services/tournamentYearHelpers";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintageStandingsContent } from "@/lib/vintage/standingsStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";

/**
 * Standings: Live Standings only (vintage) for everyone when enabled.
 * Default year comes from Standings CMS `standingsYear` (not Tourney Year).
 */
export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  if (!isVintageEnabled()) notFound();

  const params = await searchParams;
  const [home, copy, snapshotYears, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    getPublishedVintageStandingsContent(),
    listLiveStandingsYears().catch(() => [] as number[]),
    vintageAdminEmail(),
  ]);
  const standingsDefaultYear = parseInt(copy.standingsYear.trim(), 10);
  const defaultYear = Number.isFinite(standingsDefaultYear)
    ? standingsDefaultYear
    : new Date().getFullYear();
  const viewingYear = parseViewingYear(params.year, defaultYear);
  const availableYears = mergeAvailableYears(
    [...snapshotYears, ...listStandingsArchiveYears()],
    defaultYear,
  );

  return (
    <>
      <PageLogger location="Standings" />
      <VintageLiveStandings
        home={home}
        copy={copy}
        admin={Boolean(adminEmail)}
        standingsDefaultYear={defaultYear}
        viewingYear={viewingYear}
        availableYears={availableYears}
      />
    </>
  );
}
