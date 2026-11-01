import { Suspense } from "react";
import { PageLogger } from "@/components/PageLogger";
import StandingsLoadingShell from "@/components/vintage/standings/StandingsLoadingShell";
import VintageLiveStandings from "@/components/vintage/standings/VintageLiveStandings";
import { listLiveStandingsYears } from "@/lib/repositories/liveStandingsSnapshotRepository";
import { listStandingsArchiveYears } from "@/lib/legacyStandings/years";
import {
  mergeAvailableYears,
  parseViewingYear,
} from "@/lib/services/tournamentYearHelpers";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";
import { SiteConfigError } from "@/lib/siteConfig";
import { cmsRouteMetadata } from "@/lib/pageMetadata";
import { getLiveStandingsSnapshot } from "@/lib/repositories/liveStandingsSnapshotRepository";
import { shouldUseStandingsRosterMode } from "@/lib/services/standingsRosterGate";
import { isNewspaperStandingsYear } from "@/lib/legacyStandings/years";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { getPublishedCmsBundle } = await import("@/lib/vintage/cmsBundle");
  const bundle = await getPublishedCmsBundle().catch(() => null);
  return cmsRouteMetadata(bundle?.standings.heading ?? "");
}

/**
 * Resolve CMS + years, then mount the interactive standings client.
 */
async function StandingsPageBody({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const [bundle, snapshotYears, adminEmail] = await Promise.all([
    getPublishedCmsBundle(),
    listLiveStandingsYears().catch(() => [] as number[]),
    vintageAdminEmail(),
  ]);
  const copy = bundle.standings;
  const defaultYear = parseInt(copy.standingsYear.trim(), 10);
  if (!Number.isFinite(defaultYear)) {
    throw new SiteConfigError("Published Standings CMS is missing a valid Standings Year.");
  }
  const viewingYear = parseViewingYear(params.year, defaultYear);
  const availableYears = mergeAvailableYears(
    [...snapshotYears, ...listStandingsArchiveYears()],
    defaultYear,
  );
  const activeYear = parseInt(bundle.home.tournament.year.trim(), 10);
  const useRoster =
    !isNewspaperStandingsYear(viewingYear) &&
    shouldUseStandingsRosterMode(viewingYear, activeYear, copy.tournamentLive);
  const snapshot =
    useRoster || isNewspaperStandingsYear(viewingYear)
      ? null
      : await getLiveStandingsSnapshot(viewingYear).catch(() => null);

  return (
    <>
      <PageLogger location="Standings" />
      <VintageLiveStandings
        home={bundle.home}
        copy={copy}
        paymentBadges={bundle.picks.payment}
        bracketEditorCopy={bundle.bracketEditor}
        admin={Boolean(adminEmail)}
        standingsDefaultYear={defaultYear}
        viewingYear={viewingYear}
        availableYears={availableYears}
        initialSnapshot={
          snapshot
            ? {
                standingsData: snapshot.standingsData,
                computedAt: snapshot.computedAt.toISOString(),
              }
            : null
        }
      />
    </>
  );
}

/**
 * Standings: Live Standings for everyone.
 * Suspense + route `loading.tsx` show headline chrome immediately (My Picks pattern).
 */
export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  return (
    <Suspense fallback={<StandingsLoadingShell />}>
      <StandingsPageBody searchParams={searchParams} />
    </Suspense>
  );
}
