import PrintBracketClient from "./PrintBracketClient";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";
import { getActiveTournamentYear } from "@/lib/services/tournamentYearService";
import { getSiteConfigCached } from "@/lib/siteConfigServer";

export const dynamic = "force-dynamic";

/**
 * Printable bracket: picks come from sessionStorage (client); the server supplies
 * the print copy from Bracket Editor Messages and the active tournament year.
 */
export default async function PrintBracketPage() {
  const [bundle, activeYear, siteConfig] = await Promise.all([
    getPublishedCmsBundle(),
    getActiveTournamentYear(),
    getSiteConfigCached().catch(() => null),
  ]);
  return (
    <PrintBracketClient
      copy={bundle.bracketEditor}
      activeYear={activeYear}
      siteName={siteConfig?.siteName?.trim() || "Warren's March Madness"}
    />
  );
}
