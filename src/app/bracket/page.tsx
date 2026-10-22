import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import BracketPageClient from "./BracketPageClient";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintagePicksContent } from "@/lib/vintage/picksStore";
import { getPublishedVintageStandingsContent } from "@/lib/vintage/standingsStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";

/**
 * My Picks: vintage landing for everyone when enabled.
 * Bracket workspace UI is unchanged; CMS edit gear is primary-admin-only.
 */
export default async function BracketPage() {
  if (!isVintageEnabled()) notFound();

  const [home, picksCopy, standingsChrome, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    getPublishedVintagePicksContent(),
    getPublishedVintageStandingsContent(),
    vintageAdminEmail(),
  ]);

  return (
    <>
      <PageLogger location="My Picks" />
      <BracketPageClient
        vintage
        vintageHome={home}
        picksCopy={picksCopy}
        standingsChrome={standingsChrome}
        vintageAdmin={Boolean(adminEmail)}
      />
    </>
  );
}
