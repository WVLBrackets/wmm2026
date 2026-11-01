import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { PageLogger } from "@/components/PageLogger";
import BracketPageClient from "./BracketPageClient";
import { authOptions } from "@/lib/auth";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";
import { applyHomepageKeyDataToPicks } from "@/lib/vintage/seasonKeyData";
import { getSiteConfigCached } from "@/lib/siteConfigServer";
import { getUserByEmail } from "@/lib/repositories/userRepository";
import { loadMyPicksField, loadMyPicksList } from "@/lib/services/myPicksService";
import {
  getActiveTournamentYear,
  parseViewingYear,
} from "@/lib/services/tournamentYearService";

export const dynamic = "force-dynamic";

/**
 * My Picks: server loads CMS, the active-year field, and the viewer's bracket list
 * in parallel so the first paint needs no client waterfall.
 * Season gates (published / cost / master lock) come from homepage Key Data.
 */
export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/auth/signin?callbackUrl=/bracket");

  const [params, bundle, activeYear, siteConfig, adminEmail, user] = await Promise.all([
    searchParams,
    getPublishedCmsBundle(),
    getActiveTournamentYear(),
    getSiteConfigCached(),
    vintageAdminEmail(),
    getUserByEmail(email),
  ]);
  if (!user) redirect("/auth/signin?callbackUrl=/bracket");

  const viewingYear = parseViewingYear(params.year, activeYear);
  const viewer = { name: user.name || session?.user?.name || "", email: user.email };
  const [field, list] = await Promise.all([
    loadMyPicksField(activeYear),
    loadMyPicksList({ id: user.id, ...viewer }, viewingYear, activeYear),
  ]);

  return (
    <>
      <PageLogger location="My Picks" />
      <BracketPageClient
        vintageHome={bundle.home}
        picksCopy={applyHomepageKeyDataToPicks(bundle.home, bundle.picks)}
        bracketEditorCopy={bundle.bracketEditor}
        pdfDialogCopy={bundle.emails.pdfDialog}
        standingsChrome={bundle.standings}
        siteConfig={siteConfig}
        vintageAdmin={Boolean(adminEmail)}
        viewer={viewer}
        initial={{
          activeYear,
          viewingYear: list.viewingYear,
          availableYears: list.availableYears,
          brackets: list.brackets,
          tournamentData: field,
        }}
      />
    </>
  );
}
