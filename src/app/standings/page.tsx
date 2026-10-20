import { PageLogger } from "@/components/PageLogger";
import LegacySiteChrome from "@/components/LegacySiteChrome";
import StandingsShell from "@/components/StandingsShell";
import VintageLiveStandings from "@/components/vintage/standings/VintageLiveStandings";
import { getBuildStamp } from "@/lib/buildStamp";
import { listLiveStandingsYears } from "@/lib/repositories/liveStandingsSnapshotRepository";
import {
  mergeAvailableYears,
  parseViewingYear,
} from "@/lib/services/tournamentYearService";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedVintageStandingsContent } from "@/lib/vintage/standingsStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await vintageAdminEmail())
    ? { robots: { index: false, follow: false } }
    : {};
}

/**
 * Standings: vintage Live Standings for the primary admin; legacy Daily/Live for everyone else.
 * Default year comes from Standings CMS `standingsYear` (not Tourney Year).
 */
export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;

  if (await vintageAdminEmail()) {
    const [home, copy, snapshotYears] = await Promise.all([
      getPublishedVintageContent(),
      getPublishedVintageStandingsContent(),
      listLiveStandingsYears().catch(() => [] as number[]),
    ]);
    const standingsDefaultYear = parseInt(copy.standingsYear.trim(), 10);
    const defaultYear = Number.isFinite(standingsDefaultYear)
      ? standingsDefaultYear
      : new Date().getFullYear();
    const viewingYear = parseViewingYear(params.year, defaultYear);
    const availableYears = mergeAvailableYears(snapshotYears, defaultYear);

    return (
      <>
        <PageLogger location="Standings" />
        <VintageLiveStandings
          home={home}
          copy={copy}
          admin
          standingsDefaultYear={defaultYear}
          viewingYear={viewingYear}
          availableYears={availableYears}
        />
      </>
    );
  }

  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <PageLogger location="Standings" />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <StandingsShell />
        </div>
      </div>
    </LegacySiteChrome>
  );
}
