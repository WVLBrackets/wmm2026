import { notFound } from "next/navigation";
import { PageLogger } from "@/components/PageLogger";
import BracketPageClient from "./BracketPageClient";
import { vintageAdminEmail } from "@/lib/vintage/admin";
import { isVintageEnabled } from "@/lib/vintage/access";
import { getPublishedVintagePicksContent } from "@/lib/vintage/picksStore";
import { applyHomepageKeyDataToPicks } from "@/lib/vintage/seasonKeyData";
import { getPublishedVintageStandingsContent } from "@/lib/vintage/standingsStore";
import { getPublishedVintageContent } from "@/lib/vintage/store";

export const dynamic = "force-dynamic";

/**
 * My Picks: vintage landing for everyone when enabled.
 * Bracket workspace UI is unchanged; CMS edit gear is primary-admin-only.
 * Season gates (published / cost / master lock) come from homepage Key Data.
 */
export default async function BracketPage() {
  if (!isVintageEnabled()) notFound();

  const [home, picksRaw, standingsChrome, adminEmail] = await Promise.all([
    getPublishedVintageContent(),
    getPublishedVintagePicksContent(),
    getPublishedVintageStandingsContent(),
    vintageAdminEmail(),
  ]);
  const picksCopy = applyHomepageKeyDataToPicks(home, picksRaw);

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
