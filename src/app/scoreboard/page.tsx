import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import ScoreboardLoadingShell from "@/components/vintage/scoreboard/ScoreboardLoadingShell";
import VintageScoreboard from "@/components/vintage/scoreboard/VintageScoreboard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/adminAuth";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";
import {
  mergeAvailableYears,
  parseViewingYear,
} from "@/lib/services/tournamentYearHelpers";
import { getPublicScoreboard } from "@/lib/services/publicScoreboardService";
import {
  getScoreboardDefaultYear,
  listScoreboardYears,
} from "@/lib/repositories/scoreboardRepository";
import { listTournamentFieldYears } from "@/lib/tournamentLoaderServer";
import { filterScoreboardYears } from "@/lib/scoreboardYears";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { getPublishedCmsBundle } = await import("@/lib/vintage/cmsBundle");
  const bundle = await getPublishedCmsBundle().catch(() => null);
  const { cmsRouteMetadata } = await import("@/lib/pageMetadata");
  return cmsRouteMetadata(bundle?.scoreboard.heading ?? "");
}

/**
 * Gear / edit UI for primary vintage admin or ops ADMIN_EMAIL (local).
 */
async function canEditScoreboard(): Promise<boolean> {
  const primary = await vintageAdminEmail();
  if (primary) return true;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return false;
  return isAdmin(email);
}

/**
 * Resolve CMS + snapshot for one scoreboard group, then mount the client.
 * Same shape as Standings: single `/scoreboard` route, `group` / `year` via searchParams.
 */
async function ScoreboardPageBody({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; year?: string; edit?: string }>;
}) {
  const sp = await searchParams;
  const [bundle, showAdminGear, seededYears] = await Promise.all([
    getPublishedCmsBundle(),
    canEditScoreboard(),
    listScoreboardYears().catch(() => [] as number[]),
  ]);
  const home = bundle.home;
  const activeYear = parseInt(home.tournament.year, 10);
  const scoreboardDefaultYear = await getScoreboardDefaultYear(activeYear).catch(
    () => activeYear,
  );
  const requestedYear = parseViewingYear(sp.year, scoreboardDefaultYear);
  // Historical boards start at 2026 — ignore older ?year= values.
  const viewingYear =
    requestedYear < 2026 ? scoreboardDefaultYear : requestedYear;
  const groupSlug =
    typeof sp.group === "string" && sp.group.trim() ? sp.group.trim() : null;

  let board;
  try {
    board = await getPublicScoreboard(viewingYear, groupSlug);
  } catch (error) {
    console.error("[scoreboard page]", error);
    notFound();
  }

  // Seeded DB years + field JSON years; never expose pre-2026 boards.
  const availableYears = filterScoreboardYears(
    mergeAvailableYears(
      [...seededYears, ...listTournamentFieldYears(), viewingYear],
      scoreboardDefaultYear,
    ),
  );
  const editMode = sp.edit === "1" && showAdminGear;

  return (
    <>
      <PageLogger location={`Scoreboard:${board.page.slug}`} />
      <VintageScoreboard
        home={home}
        copy={bundle.scoreboard}
        admin={showAdminGear}
        initialBoard={board}
        availableYears={availableYears}
        activeYear={scoreboardDefaultYear}
        viewingYear={viewingYear}
        editMode={editMode}
      />
    </>
  );
}

/**
 * Public Scoreboard — peer of Standings (flat route, no `/[slug]` segment).
 * Suspense + route `loading.tsx` show headline chrome immediately.
 */
export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; year?: string; edit?: string }>;
}) {

  return (
    <Suspense fallback={<ScoreboardLoadingShell />}>
      <ScoreboardPageBody searchParams={searchParams} />
    </Suspense>
  );
}
